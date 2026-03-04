#!/usr/bin/env python3
"""
iPhone風ドキュメントスキャナー v2
- 書類の輪郭を自動検出し、背景を除去
- 遠近補正（パースペクティブ変換）で正面から撮ったように
- 顔写真はカラーのまま残す（履歴書の証明写真のみ）
- その他の部分はスキャン風（白い背景 + くっきりした文字）
"""

import cv2
import numpy as np
import os
import subprocess
from pathlib import Path


def order_points(pts):
    """4つの点を [左上, 右上, 右下, 左下] の順に並べ替える"""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # 左上
    rect[2] = pts[np.argmax(s)]   # 右下
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # 右上
    rect[3] = pts[np.argmax(diff)] # 左下
    return rect


def four_point_transform(image, pts):
    """4点からのパースペクティブ変換"""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped


def find_document_contour(image):
    """
    画像から書類の輪郭（四角形）を検出
    複数の手法を組み合わせて検出率を上げる
    """
    h, w = image.shape[:2]
    ratio = 500.0 / max(h, w)
    small = cv2.resize(image, (int(w * ratio), int(h * ratio)))
    img_area = small.shape[0] * small.shape[1]

    # --- 手法1: Cannyエッジ ---
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    for low, high in [(30, 100), (50, 150), (20, 80)]:
        edged = cv2.Canny(blurred, low, high)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edged = cv2.dilate(edged, kernel, iterations=2)

        contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                area = cv2.contourArea(approx)
                if area > img_area * 0.15:
                    pts = approx.reshape(4, 2) / ratio
                    return pts

    # --- 手法2: 白い紙の検出（HSV空間）---
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    # 白い領域: 彩度が低く、明度が高い
    lower_white = np.array([0, 0, 150])
    upper_white = np.array([180, 60, 255])
    mask = cv2.inRange(hsv, lower_white, upper_white)

    # モルフォロジー処理で穴を埋める
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=5)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:3]

    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area * 0.20:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2) / ratio
            return pts
        # 4点じゃなくても、大きい矩形なら最小外接矩形を使う
        if area > img_area * 0.30:
            rect = cv2.minAreaRect(c)
            box = cv2.boxPoints(rect)
            box = box / ratio
            return box

    # --- 手法3: 明るさベースの閾値 ---
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=5)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:3]

    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area * 0.30:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.03 * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2) / ratio
            return pts
        # 最小外接矩形
        if area > img_area * 0.35:
            rect = cv2.minAreaRect(c)
            box = cv2.boxPoints(rect)
            box = box / ratio
            return box

    return None


def detect_face_regions(image):
    """
    顔領域を検出（証明写真サイズのみ）
    誤検出を減らすため、画像全体に対して小さすぎる/大きすぎる顔は無視
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )

    # スケール大きめ、隣接数を増やして誤検出を減らす
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.15,
        minNeighbors=8,
        minSize=(50, 50),
        flags=cv2.CASCADE_SCALE_IMAGE
    )

    if len(faces) == 0:
        return []

    # 証明写真サイズのフィルタリング
    # 証明写真: 画像全体の約3%〜15%のサイズ
    img_area = h * w
    valid_faces = []
    for (x, y, fw, fh) in faces:
        face_area = fw * fh
        ratio = face_area / img_area
        # 証明写真サイズ: 画像の1%〜20%
        if 0.005 < ratio < 0.20:
            # 上半分に位置する可能性が高い（履歴書の右上）
            valid_faces.append((x, y, fw, fh))

    return valid_faces


def apply_scan_effect(image, face_regions=None):
    """
    ナチュラルなスキャン風効果
    - 背景を白く、文字をくっきり
    - 過度なコントラスト強調はしない
    - 顔写真部分はカラーで残す
    """
    h, w = image.shape[:2]

    # グレースケール変換
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 軽いCLAHE（局所コントラスト補正、穏やか設定）
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(11, 11))
    enhanced = clahe.apply(gray)

    # 背景を白くする: アダプティブ背景推定
    # 大きいブロックサイズでローカル背景を推定
    bg = cv2.GaussianBlur(enhanced, (51, 51), 0)
    # 背景からの差分で文字部分を強調
    diff = cv2.subtract(bg, enhanced)  # 暗い部分（文字）が大きい値になる
    # 反転して白背景に
    result = 255 - cv2.normalize(diff, None, 0, 200, cv2.NORM_MINMAX)

    # さらに白い部分をより白く（レベル補正）
    p10, p90 = np.percentile(result, [10, 92])
    result = np.clip((result.astype(float) - p10) * 255.0 / max(p90 - p10, 1), 0, 255).astype(np.uint8)

    # 軽いシャープ化（穏やかに）
    kernel_sharpen = np.array([
        [0, -0.3, 0],
        [-0.3, 2.2, -0.3],
        [0, -0.3, 0]
    ])
    result = cv2.filter2D(result, -1, kernel_sharpen)
    result = np.clip(result, 0, 255).astype(np.uint8)

    # 3チャンネルに
    scanned = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)

    # 顔領域はカラーで残す
    if face_regions is not None and len(face_regions) > 0:
        for (x, y, fw, fh) in face_regions:
            # 証明写真全体をカバーするマージン
            margin_x = int(fw * 0.5)
            margin_y_top = int(fh * 0.4)
            margin_y_bottom = int(fh * 0.7)

            x1 = max(0, x - margin_x)
            y1 = max(0, y - margin_y_top)
            x2 = min(w, x + fw + margin_x)
            y2 = min(h, y + fh + margin_y_bottom)

            # ブレンドマスク
            mask = np.zeros((h, w), dtype=np.float32)
            mask[y1:y2, x1:x2] = 1.0
            mask = cv2.GaussianBlur(mask, (31, 31), 12)
            mask3 = np.stack([mask] * 3, axis=-1)

            # カラー画像を少し明るく補正
            color_part = image.copy()
            lab = cv2.cvtColor(color_part, cv2.COLOR_BGR2LAB)
            l_ch = lab[:, :, 0]
            l_ch = clahe.apply(l_ch)
            lab[:, :, 0] = l_ch
            color_part = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

            scanned = (color_part * mask3 + scanned * (1 - mask3)).astype(np.uint8)

    return scanned


def should_detect_face(filename):
    """顔検出を行うべきファイルかどうか（履歴書系のみ）"""
    face_keywords = ['履歴書', '保育士証', '免許', '登録証', '修了証']
    return any(kw in filename for kw in face_keywords)


def process_image(input_path, output_path, filename=""):
    """1枚の画像を処理"""
    image = cv2.imread(str(input_path))
    if image is None:
        print(f"  [ERROR] Cannot read: {input_path}")
        return False

    h, w = image.shape[:2]

    # 1. 書類の輪郭を検出
    contour = find_document_contour(image)

    if contour is not None:
        warped = four_point_transform(image, contour.astype("float32"))
        wh, ww = warped.shape[:2]
        # 極端に小さくなった場合は検出失敗とみなす
        if wh < h * 0.3 or ww < w * 0.3:
            print(f"  [WARN] Detected area too small, using full image")
            margin = int(min(h, w) * 0.01)
            warped = image[margin:h-margin, margin:w-margin]
        else:
            print(f"  [CROP] Document edges detected, perspective corrected")
    else:
        margin = int(min(h, w) * 0.01)
        warped = image[margin:h-margin, margin:w-margin]
        print(f"  [FULL] No document edges found, using full image")

    # 2. 縦横の判定 - もし横長で書類が縦長であるべきなら回転
    wh, ww = warped.shape[:2]
    if ww > wh * 1.2:
        # 横長 → 多くの書類は縦長なので90度回転するか判断
        # ただし横長の書類もあるので、大きく横長の場合のみ
        pass  # そのまま

    # 3. 顔検出（履歴書系のみ）
    faces = []
    if should_detect_face(filename):
        faces = detect_face_regions(warped)
        if len(faces) > 0:
            print(f"  [FACE] {len(faces)} face(s) → keeping color")

    # 4. スキャン風効果を適用
    scanned = apply_scan_effect(warped, faces if len(faces) > 0 else None)

    # 5. A4サイズに正規化
    sh, sw = scanned.shape[:2]
    aspect = sh / sw

    if aspect > 1:
        target_w = 2480
        target_h = int(target_w * aspect)
        if target_h > 3508:
            target_h = 3508
            target_w = int(target_h / aspect)
    else:
        target_h = 2480
        target_w = int(target_h / aspect)
        if target_w > 3508:
            target_w = 3508
            target_h = int(target_w * aspect)

    scanned = cv2.resize(scanned, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

    # 6. PDF出力
    tmp_png = str(output_path).replace('.pdf', '_tmp.png')
    cv2.imwrite(tmp_png, scanned, [cv2.IMWRITE_PNG_COMPRESSION, 5])

    try:
        subprocess.run([
            "magick", tmp_png,
            "-density", "300",
            "-quality", "85",
            str(output_path)
        ], check=True, capture_output=True, timeout=30)
        os.remove(tmp_png)
        return True
    except Exception as e:
        print(f"  [ERROR] PDF conversion failed: {e}")
        return False


def main():
    input_base = "/Users/inu/Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco/追加データ/資格証や履歴書や辞令など書類"
    output_base = "/Users/inu/Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco/追加データ/スキャン風PDF"

    staff_dirs = [
        "酒井くるみ", "平井菜央", "水石晶子", "長尾麻由子", "大石瑠美",
        "宮古萌慧", "畠昂哉", "佐野春津代", "一木朋恵", "事業所_pocopoco", "清田麻由子"
    ]

    total = 0
    success = 0
    errors = 0

    for staff_dir in staff_dirs:
        input_dir = os.path.join(input_base, staff_dir)
        output_dir = os.path.join(output_base, staff_dir)

        if not os.path.isdir(input_dir):
            continue

        os.makedirs(output_dir, exist_ok=True)
        print(f"\n=== {staff_dir} ===")

        for filename in sorted(os.listdir(input_dir)):
            if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue

            total += 1
            nameonly = Path(filename).stem
            output_path = os.path.join(output_dir, f"{nameonly}.pdf")
            input_path = os.path.join(input_dir, filename)

            print(f"  Processing: {filename}")

            if process_image(input_path, output_path, filename):
                success += 1
                size_kb = os.path.getsize(output_path) / 1024
                print(f"  -> {nameonly}.pdf ({size_kb:.0f}KB)")
            else:
                errors += 1

    print(f"\n{'='*50}")
    print(f"Done: {success}/{total} success, {errors} errors")
    print(f"Output: {output_base}")


if __name__ == "__main__":
    main()
