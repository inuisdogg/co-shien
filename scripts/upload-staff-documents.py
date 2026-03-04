#!/usr/bin/env python3
"""
スタッフ書類アップロードスクリプト
- iCloudフォルダと追加データフォルダの書類をSupabase Storageにアップロード
- .docファイルをPDFに変換（textutil経由）
- 写真をスキャン風PDFに変換（ImageMagick）
- staff_documentsテーブルに登録
"""

import os
import sys
import json
import uuid
import subprocess
import urllib.request
import urllib.error
import ssl
import mimetypes
from pathlib import Path
from datetime import datetime

# Supabase config
SUPABASE_URL = "https://iskgcqzozsemlmbvubna.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE"
FACILITY_ID = "facility-1770623012121"

# Staff name -> user_id mapping
STAFF_MAP = {
    "酒井": "pocopoco-staff-sakai",
    "酒井くるみ": "pocopoco-staff-sakai",
    "平井": "pocopoco-staff-hirai",
    "平井菜央": "pocopoco-staff-hirai",
    "水石": "pocopoco-staff-mizuishi",
    "水石晶子": "pocopoco-staff-mizuishi",
    "長尾": "pocopoco-staff-nagao",
    "長尾麻由子": "pocopoco-staff-nagao",
    "大石": "pocopoco-staff-oishi",
    "大石瑠美": "pocopoco-staff-oishi",
    "宮古": "pocopoco-staff-yogo",   # 宮古萌慧 maps to yogo slot
    "宮古萌慧": "pocopoco-staff-yogo",
    "余郷": "pocopoco-staff-yogo",
    "笹野": "pocopoco-staff-sasano",
    "畠": "c6f4c329-17e6-4fcc-a1de-28cfbe08b504",  # owner UUID
    "畠昂哉": "c6f4c329-17e6-4fcc-a1de-28cfbe08b504",
}

# Document type classification
DOC_TYPE_MAP = {
    "給与明細": "payslip",
    "源泉徴収票": "withholding_tax",
    "雇用契約書": "employment_contract",
    "労働条件通知書": "wage_notice",
    "労働条件変更通知書": "wage_notice",
    "社会保険": "social_insurance",
    "健康保険": "social_insurance",
    "厚生年金": "social_insurance",
    "雇用保険": "social_insurance",
    "社保": "social_insurance",
    "年末調整": "year_end_adjustment",
    "履歴書": "other",
    "職務経歴書": "other",
    "保育士証": "other",
    "資格証": "other",
    "免許状": "other",
    "修了証": "other",
    "実務経験証明書": "other",
    "辞令": "other",
    "秘密保持誓約書": "other",
    "就労証明書": "other",
    "採用通知書": "other",
    "指定通知書": "other",
    "協定書": "other",
    "登録証": "other",
    "喪失連絡票": "social_insurance",
}

TMP_DIR = "/tmp/staff_doc_upload"
os.makedirs(TMP_DIR, exist_ok=True)

ssl_ctx = ssl.create_default_context()

def classify_document(filename):
    """Classify document type from filename"""
    for keyword, doc_type in DOC_TYPE_MAP.items():
        if keyword in filename:
            return doc_type
    return "other"

def identify_staff(filepath, filename):
    """Identify staff member from file path or name"""
    full_path = str(filepath)
    for name, user_id in STAFF_MAP.items():
        if name in full_path or name in filename:
            return user_id
    return None

def extract_period(filename):
    """Extract year/month from filename like '2025年12月_給与明細_...'"""
    import re
    m = re.search(r'(\d{4})年(\d{1,2})月', filename)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r'令和(\d+)年', filename)
    if m:
        year = 2018 + int(m.group(1))
        return year, None
    return None, None

def convert_doc_to_pdf(doc_path):
    """Convert .doc file to PDF via textutil -> HTML -> wkhtmltopdf fallback or just keep HTML"""
    # First convert to HTML
    html_path = os.path.join(TMP_DIR, f"{uuid.uuid4()}.html")
    try:
        subprocess.run(
            ["textutil", "-convert", "html", str(doc_path), "-output", html_path],
            check=True, capture_output=True, timeout=30
        )
    except subprocess.CalledProcessError as e:
        print(f"  [WARN] textutil failed for {doc_path}: {e}")
        return None

    # Try to convert HTML to PDF using python
    # Simple approach: use textutil -convert rtf then convert
    # Actually, the best approach for macOS is: textutil -convert rtf, then cupsfilter
    pdf_path = os.path.join(TMP_DIR, f"{uuid.uuid4()}.pdf")
    try:
        # Try cupsfilter for HTML -> PDF
        result = subprocess.run(
            ["cupsfilter", html_path],
            capture_output=True, timeout=30
        )
        if result.returncode == 0 and len(result.stdout) > 100:
            with open(pdf_path, 'wb') as f:
                f.write(result.stdout)
            return pdf_path
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    # Fallback: return HTML as is (upload as HTML)
    return html_path

def convert_image_to_scanned_pdf(image_path):
    """Convert photo to scan-like PDF using ImageMagick"""
    pdf_path = os.path.join(TMP_DIR, f"{uuid.uuid4()}.pdf")
    try:
        # ImageMagick pipeline:
        # 1. Deskew (straighten)
        # 2. Convert to grayscale
        # 3. Increase contrast (levels)
        # 4. Sharpen
        # 5. Clean background (threshold + blur combo)
        # 6. Output as PDF
        subprocess.run([
            "magick", str(image_path),
            "-resize", "2480x3508>",      # A4 at 300dpi max
            "-deskew", "40%",             # Auto-straighten
            "-colorspace", "Gray",        # Grayscale
            "-normalize",                 # Auto-levels
            "-level", "20%,90%",          # Boost contrast, whiten background
            "-sharpen", "0x1",            # Slight sharpening
            "-quality", "90",
            "-density", "300",
            pdf_path
        ], check=True, capture_output=True, timeout=60)
        return pdf_path
    except subprocess.CalledProcessError as e:
        print(f"  [WARN] ImageMagick scan conversion failed for {image_path}: {e.stderr[:200] if e.stderr else e}")
        # Fallback: simple conversion without scan effect
        try:
            subprocess.run([
                "magick", str(image_path),
                "-resize", "2480x3508>",
                "-density", "300",
                pdf_path
            ], check=True, capture_output=True, timeout=60)
            return pdf_path
        except:
            return None

def upload_to_storage(file_path, storage_path):
    """Upload file to Supabase Storage"""
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    with open(file_path, 'rb') as f:
        data = f.read()

    from urllib.parse import quote
    url = f"{SUPABASE_URL}/storage/v1/object/documents/{quote(storage_path)}"
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", content_type)
    req.add_header("x-upsert", "true")

    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  [ERROR] Upload failed: {e.code} {error_body[:200]}")
        return None

def insert_document_record(record):
    """Insert record into staff_documents table"""
    url = f"{SUPABASE_URL}/rest/v1/staff_documents"
    data = json.dumps(record).encode()

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")

    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  [ERROR] DB insert failed: {e.code} {error_body[:200]}")
        return False

def process_file(filepath, staff_user_id, doc_type, title, target_year=None, target_month=None):
    """Process a single file: convert if needed, upload, register"""
    filepath = Path(filepath)
    if not filepath.exists():
        print(f"  [SKIP] File not found: {filepath}")
        return False

    filename = filepath.name
    ext = filepath.suffix.lower()
    file_size = filepath.stat().st_size

    upload_path = None
    upload_file = str(filepath)
    final_ext = ext

    # Convert if needed
    if ext == '.doc':
        print(f"  Converting .doc to PDF: {filename}")
        converted = convert_doc_to_pdf(filepath)
        if converted:
            upload_file = converted
            final_ext = Path(converted).suffix
        else:
            print(f"  [SKIP] Conversion failed: {filename}")
            return False
    elif ext in ('.jpg', '.jpeg', '.png', '.jpx'):
        print(f"  Converting image to scan-style PDF: {filename}")
        converted = convert_image_to_scanned_pdf(filepath)
        if converted:
            upload_file = converted
            final_ext = '.pdf'
            file_size = os.path.getsize(converted)
        else:
            # Upload original image
            pass

    # Generate storage path (ASCII-safe)
    timestamp = int(datetime.now().timestamp() * 1000)
    doc_id = uuid.uuid4().hex[:8]
    storage_path = f"staff-docs/{FACILITY_ID}/{staff_user_id}/{timestamp}_{doc_id}{final_ext}"

    print(f"  Uploading: {storage_path}")
    result = upload_to_storage(upload_file, storage_path)
    if not result:
        return False

    # Insert DB record
    file_url = storage_path
    record = {
        "facility_id": FACILITY_ID,
        "user_id": staff_user_id,
        "document_type": doc_type,
        "title": title,
        "file_url": file_url,
        "file_name": filename,
        "file_type": final_ext.lstrip('.'),
        "file_size": file_size,
        "is_read": False,
    }
    if target_year:
        record["target_year"] = target_year
    if target_month:
        record["target_month"] = target_month

    if insert_document_record(record):
        print(f"  [OK] Registered: {title}")
        return True
    return False

def main():
    ICLOUD_BASE = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco")
    STAFF_DIR = f"{ICLOUD_BASE}/採用/職員"
    PAYSLIP_DIR = f"{ICLOUD_BASE}/給与明細"
    INSURANCE_DIR = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/INU/雇用保険関係")
    EXTRA_DIR = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco/追加データ/資格証や履歴書や辞令など書類")

    success_count = 0
    fail_count = 0
    skip_count = 0

    # ======================
    # 1. Staff folders (iCloud) - direct files
    # ======================
    staff_folders = {
        "酒井さん": "pocopoco-staff-sakai",
        "平井さん": "pocopoco-staff-hirai",
        "水石さん": "pocopoco-staff-mizuishi",
        "長尾さん": "pocopoco-staff-nagao",
        "大石さん": "pocopoco-staff-oishi",
        "宮古さん": "pocopoco-staff-yogo",
        "余郷さん": "pocopoco-staff-yogo",
        "笹野さん": "pocopoco-staff-sasano",
    }

    for folder_name, user_id in staff_folders.items():
        folder_path = os.path.join(STAFF_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue

        print(f"\n=== {folder_name} ({user_id}) ===")

        for root, dirs, files in os.walk(folder_path):
            for filename in files:
                if filename.startswith('.'):
                    continue
                filepath = os.path.join(root, filename)
                ext = os.path.splitext(filename)[1].lower()

                # Skip non-document files
                if ext not in ('.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'):
                    continue

                doc_type = classify_document(filename)
                title = os.path.splitext(filename)[0]
                year, month = extract_period(filename)

                if process_file(filepath, user_id, doc_type, title, year, month):
                    success_count += 1
                else:
                    fail_count += 1

    # ======================
    # 2. 採用通知書 folder
    # ======================
    offer_dir = os.path.join(STAFF_DIR, "採用通知書")
    if os.path.isdir(offer_dir):
        print(f"\n=== 採用通知書 ===")
        for filename in os.listdir(offer_dir):
            if filename.startswith('.'):
                continue
            filepath = os.path.join(offer_dir, filename)
            user_id = identify_staff(filepath, filename)
            if not user_id:
                print(f"  [SKIP] Cannot identify staff for: {filename}")
                skip_count += 1
                continue

            title = os.path.splitext(filename)[0]
            if process_file(filepath, user_id, "other", title):
                success_count += 1
            else:
                fail_count += 1

    # ======================
    # 3. Top-level standalone files in staff dir
    # ======================
    for filename in os.listdir(STAFF_DIR):
        filepath = os.path.join(STAFF_DIR, filename)
        if os.path.isdir(filepath) or filename.startswith('.'):
            continue
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ('.pdf', '.doc'):
            continue

        user_id = identify_staff(filepath, filename)
        if not user_id:
            print(f"  [SKIP] Cannot identify staff for: {filename}")
            skip_count += 1
            continue

        print(f"\n=== Standalone: {filename} ===")
        doc_type = classify_document(filename)
        title = os.path.splitext(filename)[0]
        if process_file(filepath, user_id, doc_type, title):
            success_count += 1
        else:
            fail_count += 1

    # ======================
    # 4. Payslips
    # ======================
    if os.path.isdir(PAYSLIP_DIR):
        print(f"\n=== 給与明細 ===")
        for staff_dir in os.listdir(PAYSLIP_DIR):
            staff_path = os.path.join(PAYSLIP_DIR, staff_dir)
            if not os.path.isdir(staff_path) or staff_dir.startswith('.'):
                continue

            for filename in os.listdir(staff_path):
                if filename.startswith('.') or not filename.endswith('.pdf'):
                    continue
                filepath = os.path.join(staff_path, filename)
                user_id = identify_staff(filepath, filename)
                if not user_id:
                    print(f"  [SKIP] Cannot identify staff for: {filename}")
                    skip_count += 1
                    continue

                title = os.path.splitext(filename)[0]
                year, month = extract_period(filename)
                if process_file(filepath, user_id, "payslip", title, year, month):
                    success_count += 1
                else:
                    fail_count += 1

    # ======================
    # 5. Insurance documents
    # ======================
    if os.path.isdir(INSURANCE_DIR):
        print(f"\n=== 雇用保険関係 ===")
        for root, dirs, files in os.walk(INSURANCE_DIR):
            for filename in files:
                if filename.startswith('.'):
                    continue
                ext = os.path.splitext(filename)[1].lower()
                if ext not in ('.pdf',):
                    continue
                filepath = os.path.join(root, filename)
                user_id = identify_staff(filepath, filename)
                if not user_id:
                    # Company-level docs -> assign to owner
                    if "株式会社INU" in filename or "INU" in filename:
                        user_id = "c6f4c329-17e6-4fcc-a1de-28cfbe08b504"
                    else:
                        print(f"  [SKIP] Cannot identify staff for: {filename}")
                        skip_count += 1
                        continue

                title = os.path.splitext(filename)[0]
                doc_type = "social_insurance"
                if process_file(filepath, user_id, doc_type, title):
                    success_count += 1
                else:
                    fail_count += 1

    # ======================
    # 6. Extra data folder (organized by staff)
    # ======================
    if os.path.isdir(EXTRA_DIR):
        print(f"\n=== 追加データ（整理済みフォルダ） ===")
        extra_staff_map = {
            "酒井くるみ": "pocopoco-staff-sakai",
            "平井菜央": "pocopoco-staff-hirai",
            "水石晶子": "pocopoco-staff-mizuishi",
            "長尾麻由子": "pocopoco-staff-nagao",
            "大石瑠美": "pocopoco-staff-oishi",
            "宮古萌慧": "pocopoco-staff-yogo",
            "畠昂哉": "c6f4c329-17e6-4fcc-a1de-28cfbe08b504",
        }

        for folder_name, user_id in extra_staff_map.items():
            folder_path = os.path.join(EXTRA_DIR, folder_name)
            if not os.path.isdir(folder_path):
                continue

            print(f"\n--- {folder_name} ---")
            for filename in os.listdir(folder_path):
                if filename.startswith('.'):
                    continue
                filepath = os.path.join(folder_path, filename)
                if os.path.isdir(filepath):
                    continue

                ext = os.path.splitext(filename)[1].lower()
                if ext not in ('.jpg', '.jpeg', '.png', '.pdf'):
                    continue

                doc_type = classify_document(filename)
                title = os.path.splitext(filename)[0]
                if process_file(filepath, user_id, doc_type, title):
                    success_count += 1
                else:
                    fail_count += 1

    print(f"\n{'='*50}")
    print(f"完了: {success_count} 成功, {fail_count} 失敗, {skip_count} スキップ")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
