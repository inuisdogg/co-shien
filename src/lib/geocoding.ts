/**
 * --- Geocoding Utility for Japan ---
 * 日本全国の都道府県・市区町村の座標データと住所解析ユーティリティ
 *
 * JIS X 0401 都道府県コード (01-47) を使用
 * 座標は各都道府県庁所在地の代表地点
 */

// ==========================================
// A. 都道府県座標データ（全47都道府県）
// ==========================================

export const PREFECTURE_DATA: Record<string, { name: string; lat: number; lng: number }> = {
  '01': { name: '北海道', lat: 43.0646, lng: 141.3468 },
  '02': { name: '青森県', lat: 40.8246, lng: 140.7400 },
  '03': { name: '岩手県', lat: 39.7036, lng: 141.1527 },
  '04': { name: '宮城県', lat: 38.2688, lng: 140.8721 },
  '05': { name: '秋田県', lat: 39.7186, lng: 140.1024 },
  '06': { name: '山形県', lat: 38.2405, lng: 140.3634 },
  '07': { name: '福島県', lat: 37.7503, lng: 140.4676 },
  '08': { name: '茨城県', lat: 36.3418, lng: 140.4468 },
  '09': { name: '栃木県', lat: 36.5657, lng: 139.8836 },
  '10': { name: '群馬県', lat: 36.3912, lng: 139.0608 },
  '11': { name: '埼玉県', lat: 35.8569, lng: 139.6489 },
  '12': { name: '千葉県', lat: 35.6047, lng: 140.1233 },
  '13': { name: '東京都', lat: 35.6895, lng: 139.6917 },
  '14': { name: '神奈川県', lat: 35.4478, lng: 139.6425 },
  '15': { name: '新潟県', lat: 37.9026, lng: 139.0236 },
  '16': { name: '富山県', lat: 36.6953, lng: 137.2114 },
  '17': { name: '石川県', lat: 36.5946, lng: 136.6256 },
  '18': { name: '福井県', lat: 36.0652, lng: 136.2217 },
  '19': { name: '山梨県', lat: 35.6642, lng: 138.5684 },
  '20': { name: '長野県', lat: 36.2321, lng: 138.1818 },
  '21': { name: '岐阜県', lat: 35.3912, lng: 136.7223 },
  '22': { name: '静岡県', lat: 34.9769, lng: 138.3831 },
  '23': { name: '愛知県', lat: 35.1802, lng: 136.9066 },
  '24': { name: '三重県', lat: 34.7303, lng: 136.5086 },
  '25': { name: '滋賀県', lat: 35.0045, lng: 135.8686 },
  '26': { name: '京都府', lat: 35.0214, lng: 135.7556 },
  '27': { name: '大阪府', lat: 34.6863, lng: 135.5200 },
  '28': { name: '兵庫県', lat: 34.6913, lng: 135.1830 },
  '29': { name: '奈良県', lat: 34.6851, lng: 135.8329 },
  '30': { name: '和歌山県', lat: 34.2260, lng: 135.1675 },
  '31': { name: '鳥取県', lat: 35.5039, lng: 134.2383 },
  '32': { name: '島根県', lat: 35.4723, lng: 133.0505 },
  '33': { name: '岡山県', lat: 34.6618, lng: 133.9344 },
  '34': { name: '広島県', lat: 34.3966, lng: 132.4596 },
  '35': { name: '山口県', lat: 34.1861, lng: 131.4705 },
  '36': { name: '徳島県', lat: 34.0658, lng: 134.5593 },
  '37': { name: '香川県', lat: 34.3401, lng: 134.0434 },
  '38': { name: '愛媛県', lat: 33.8416, lng: 132.7657 },
  '39': { name: '高知県', lat: 33.5597, lng: 133.5311 },
  '40': { name: '福岡県', lat: 33.5902, lng: 130.4017 },
  '41': { name: '佐賀県', lat: 33.2494, lng: 130.2988 },
  '42': { name: '長崎県', lat: 32.7448, lng: 129.8737 },
  '43': { name: '熊本県', lat: 32.7898, lng: 130.7417 },
  '44': { name: '大分県', lat: 33.2382, lng: 131.6126 },
  '45': { name: '宮崎県', lat: 31.9111, lng: 131.4239 },
  '46': { name: '鹿児島県', lat: 31.5602, lng: 130.5581 },
  '47': { name: '沖縄県', lat: 26.3344, lng: 127.8056 },
};

// ==========================================
// B. 主要市区町村座標データ
// ==========================================

export const CITY_COORDS: Record<string, { lat: number; lng: number; prefecture: string }> = {
  // ==========================================
  // 北海道 (01)
  // ==========================================
  '札幌市': { lat: 43.0621, lng: 141.3544, prefecture: '01' },
  '旭川市': { lat: 43.7707, lng: 142.3650, prefecture: '01' },
  '函館市': { lat: 41.7687, lng: 140.7288, prefecture: '01' },
  '釧路市': { lat: 42.9849, lng: 144.3820, prefecture: '01' },
  '帯広市': { lat: 42.9236, lng: 143.1966, prefecture: '01' },
  '苫小牧市': { lat: 42.6340, lng: 141.6054, prefecture: '01' },
  '小樽市': { lat: 43.1907, lng: 140.9946, prefecture: '01' },
  '北見市': { lat: 43.8030, lng: 143.8907, prefecture: '01' },
  '江別市': { lat: 43.1037, lng: 141.5362, prefecture: '01' },
  '千歳市': { lat: 42.8198, lng: 141.6514, prefecture: '01' },
  '室蘭市': { lat: 42.3151, lng: 140.9739, prefecture: '01' },
  '岩見沢市': { lat: 43.1961, lng: 141.7758, prefecture: '01' },
  '恵庭市': { lat: 42.8826, lng: 141.5787, prefecture: '01' },
  '北広島市': { lat: 43.0024, lng: 141.5634, prefecture: '01' },
  '石狩市': { lat: 43.1714, lng: 141.3156, prefecture: '01' },

  // ==========================================
  // 青森県 (02)
  // ==========================================
  '青森市': { lat: 40.8246, lng: 140.7400, prefecture: '02' },
  '八戸市': { lat: 40.5124, lng: 141.4884, prefecture: '02' },
  '弘前市': { lat: 40.6031, lng: 140.4641, prefecture: '02' },

  // ==========================================
  // 岩手県 (03)
  // ==========================================
  '盛岡市': { lat: 39.7036, lng: 141.1527, prefecture: '03' },
  '一関市': { lat: 38.9345, lng: 141.1286, prefecture: '03' },
  '奥州市': { lat: 39.1445, lng: 141.1399, prefecture: '03' },
  '花巻市': { lat: 39.3887, lng: 141.1169, prefecture: '03' },

  // ==========================================
  // 宮城県 (04)
  // ==========================================
  '仙台市': { lat: 38.2688, lng: 140.8721, prefecture: '04' },
  '石巻市': { lat: 38.4343, lng: 141.3028, prefecture: '04' },
  '大崎市': { lat: 38.5774, lng: 140.9555, prefecture: '04' },
  '名取市': { lat: 38.1717, lng: 140.8917, prefecture: '04' },
  '登米市': { lat: 38.6825, lng: 141.1988, prefecture: '04' },
  '多賀城市': { lat: 38.2936, lng: 141.0048, prefecture: '04' },

  // ==========================================
  // 秋田県 (05)
  // ==========================================
  '秋田市': { lat: 39.7186, lng: 140.1024, prefecture: '05' },
  '横手市': { lat: 39.3114, lng: 140.5532, prefecture: '05' },
  '大仙市': { lat: 39.4503, lng: 140.4773, prefecture: '05' },

  // ==========================================
  // 山形県 (06)
  // ==========================================
  '山形市': { lat: 38.2405, lng: 140.3634, prefecture: '06' },
  '鶴岡市': { lat: 38.7268, lng: 139.8268, prefecture: '06' },
  '酒田市': { lat: 38.9146, lng: 139.8364, prefecture: '06' },
  '米沢市': { lat: 37.9222, lng: 140.1167, prefecture: '06' },

  // ==========================================
  // 福島県 (07)
  // ==========================================
  '福島市': { lat: 37.7503, lng: 140.4676, prefecture: '07' },
  'いわき市': { lat: 37.0505, lng: 140.8878, prefecture: '07' },
  '郡山市': { lat: 37.3998, lng: 140.3598, prefecture: '07' },
  '会津若松市': { lat: 37.4949, lng: 139.9299, prefecture: '07' },

  // ==========================================
  // 茨城県 (08)
  // ==========================================
  '水戸市': { lat: 36.3418, lng: 140.4468, prefecture: '08' },
  'つくば市': { lat: 36.0835, lng: 140.0766, prefecture: '08' },
  '日立市': { lat: 36.5991, lng: 140.6514, prefecture: '08' },
  '土浦市': { lat: 36.0748, lng: 140.2073, prefecture: '08' },
  'ひたちなか市': { lat: 36.3965, lng: 140.5348, prefecture: '08' },
  '古河市': { lat: 36.1928, lng: 139.6994, prefecture: '08' },
  '取手市': { lat: 35.9118, lng: 140.0505, prefecture: '08' },

  // ==========================================
  // 栃木県 (09)
  // ==========================================
  '宇都宮市': { lat: 36.5657, lng: 139.8836, prefecture: '09' },
  '小山市': { lat: 36.3145, lng: 139.8010, prefecture: '09' },
  '栃木市': { lat: 36.3813, lng: 139.7309, prefecture: '09' },
  '足利市': { lat: 36.3408, lng: 139.4497, prefecture: '09' },
  '佐野市': { lat: 36.3145, lng: 139.5782, prefecture: '09' },
  '那須塩原市': { lat: 36.9615, lng: 139.9926, prefecture: '09' },

  // ==========================================
  // 群馬県 (10)
  // ==========================================
  '前橋市': { lat: 36.3912, lng: 139.0608, prefecture: '10' },
  '高崎市': { lat: 36.3222, lng: 139.0029, prefecture: '10' },
  '太田市': { lat: 36.2918, lng: 139.3762, prefecture: '10' },
  '伊勢崎市': { lat: 36.3112, lng: 139.1969, prefecture: '10' },
  '桐生市': { lat: 36.4049, lng: 139.3308, prefecture: '10' },

  // ==========================================
  // 埼玉県 (11)
  // ==========================================
  'さいたま市': { lat: 35.8569, lng: 139.6489, prefecture: '11' },
  '川口市': { lat: 35.8078, lng: 139.7241, prefecture: '11' },
  '川越市': { lat: 35.9251, lng: 139.4857, prefecture: '11' },
  '所沢市': { lat: 35.7991, lng: 139.4689, prefecture: '11' },
  '越谷市': { lat: 35.8910, lng: 139.7905, prefecture: '11' },
  '草加市': { lat: 35.8266, lng: 139.8055, prefecture: '11' },
  '春日部市': { lat: 35.9752, lng: 139.7524, prefecture: '11' },
  '上尾市': { lat: 35.9774, lng: 139.5934, prefecture: '11' },
  '熊谷市': { lat: 36.1472, lng: 139.3887, prefecture: '11' },
  '新座市': { lat: 35.7935, lng: 139.5651, prefecture: '11' },
  '狭山市': { lat: 35.8530, lng: 139.4121, prefecture: '11' },
  '久喜市': { lat: 36.0621, lng: 139.6666, prefecture: '11' },
  '入間市': { lat: 35.8359, lng: 139.3912, prefecture: '11' },
  '深谷市': { lat: 36.1974, lng: 139.2814, prefecture: '11' },
  '三郷市': { lat: 35.8312, lng: 139.8694, prefecture: '11' },
  '朝霞市': { lat: 35.7973, lng: 139.5938, prefecture: '11' },
  '富士見市': { lat: 35.8575, lng: 139.5487, prefecture: '11' },
  '戸田市': { lat: 35.8171, lng: 139.6779, prefecture: '11' },
  '八潮市': { lat: 35.8230, lng: 139.8391, prefecture: '11' },
  '蕨市': { lat: 35.8256, lng: 139.6795, prefecture: '11' },
  '志木市': { lat: 35.8385, lng: 139.5806, prefecture: '11' },
  'ふじみ野市': { lat: 35.8796, lng: 139.5197, prefecture: '11' },
  '和光市': { lat: 35.7812, lng: 139.6050, prefecture: '11' },

  // ==========================================
  // 千葉県 (12)
  // ==========================================
  '千葉市': { lat: 35.6047, lng: 140.1233, prefecture: '12' },
  '船橋市': { lat: 35.6946, lng: 139.9828, prefecture: '12' },
  '松戸市': { lat: 35.7876, lng: 139.9031, prefecture: '12' },
  '市川市': { lat: 35.7220, lng: 139.9310, prefecture: '12' },
  '柏市': { lat: 35.8676, lng: 139.9718, prefecture: '12' },
  '市原市': { lat: 35.4978, lng: 140.1158, prefecture: '12' },
  '八千代市': { lat: 35.7225, lng: 140.0998, prefecture: '12' },
  '流山市': { lat: 35.8563, lng: 139.9026, prefecture: '12' },
  '佐倉市': { lat: 35.7237, lng: 140.2193, prefecture: '12' },
  '習志野市': { lat: 35.6810, lng: 140.0266, prefecture: '12' },
  '浦安市': { lat: 35.6535, lng: 139.9019, prefecture: '12' },
  '野田市': { lat: 35.9555, lng: 139.8747, prefecture: '12' },
  '木更津市': { lat: 35.3757, lng: 139.9268, prefecture: '12' },
  '我孫子市': { lat: 35.8641, lng: 140.0283, prefecture: '12' },
  '成田市': { lat: 35.7763, lng: 140.3183, prefecture: '12' },
  '鎌ケ谷市': { lat: 35.7767, lng: 139.9986, prefecture: '12' },
  '印西市': { lat: 35.8317, lng: 140.1461, prefecture: '12' },

  // ==========================================
  // 東京都 (13) - 23区 + 主要市部
  // ==========================================
  // 23特別区
  '千代田区': { lat: 35.6940, lng: 139.7536, prefecture: '13' },
  '中央区': { lat: 35.6706, lng: 139.7720, prefecture: '13' },
  '港区': { lat: 35.6581, lng: 139.7514, prefecture: '13' },
  '新宿区': { lat: 35.6938, lng: 139.7036, prefecture: '13' },
  '文京区': { lat: 35.7081, lng: 139.7522, prefecture: '13' },
  '台東区': { lat: 35.7126, lng: 139.7800, prefecture: '13' },
  '墨田区': { lat: 35.7107, lng: 139.8015, prefecture: '13' },
  '江東区': { lat: 35.6726, lng: 139.8171, prefecture: '13' },
  '品川区': { lat: 35.6092, lng: 139.7302, prefecture: '13' },
  '目黒区': { lat: 35.6414, lng: 139.6982, prefecture: '13' },
  '大田区': { lat: 35.5613, lng: 139.7161, prefecture: '13' },
  '世田谷区': { lat: 35.6461, lng: 139.6530, prefecture: '13' },
  '渋谷区': { lat: 35.6640, lng: 139.6982, prefecture: '13' },
  '中野区': { lat: 35.7077, lng: 139.6638, prefecture: '13' },
  '杉並区': { lat: 35.6995, lng: 139.6365, prefecture: '13' },
  '豊島区': { lat: 35.7263, lng: 139.7167, prefecture: '13' },
  '北区': { lat: 35.7528, lng: 139.7337, prefecture: '13' },
  '荒川区': { lat: 35.7360, lng: 139.7833, prefecture: '13' },
  '板橋区': { lat: 35.7512, lng: 139.7094, prefecture: '13' },
  '練馬区': { lat: 35.7355, lng: 139.6516, prefecture: '13' },
  '足立区': { lat: 35.7749, lng: 139.8046, prefecture: '13' },
  '葛飾区': { lat: 35.7435, lng: 139.8477, prefecture: '13' },
  '江戸川区': { lat: 35.7067, lng: 139.8685, prefecture: '13' },
  // 東京都市部
  '八王子市': { lat: 35.6664, lng: 139.3160, prefecture: '13' },
  '町田市': { lat: 35.5483, lng: 139.4388, prefecture: '13' },
  '府中市': { lat: 35.6686, lng: 139.4776, prefecture: '13' },
  '調布市': { lat: 35.6516, lng: 139.5406, prefecture: '13' },
  '西東京市': { lat: 35.7255, lng: 139.5383, prefecture: '13' },
  '三鷹市': { lat: 35.6836, lng: 139.5595, prefecture: '13' },
  '立川市': { lat: 35.6942, lng: 139.4079, prefecture: '13' },
  '日野市': { lat: 35.6711, lng: 139.3945, prefecture: '13' },
  '武蔵野市': { lat: 35.7179, lng: 139.5664, prefecture: '13' },
  '多摩市': { lat: 35.6369, lng: 139.4463, prefecture: '13' },
  '稲城市': { lat: 35.6378, lng: 139.5047, prefecture: '13' },
  '小金井市': { lat: 35.6994, lng: 139.5032, prefecture: '13' },
  '小平市': { lat: 35.7285, lng: 139.4774, prefecture: '13' },
  '東村山市': { lat: 35.7545, lng: 139.4684, prefecture: '13' },
  '国分寺市': { lat: 35.7109, lng: 139.4622, prefecture: '13' },
  '国立市': { lat: 35.6839, lng: 139.4416, prefecture: '13' },
  '狛江市': { lat: 35.6345, lng: 139.5780, prefecture: '13' },
  '東大和市': { lat: 35.7451, lng: 139.4265, prefecture: '13' },
  '清瀬市': { lat: 35.7855, lng: 139.5182, prefecture: '13' },
  '東久留米市': { lat: 35.7589, lng: 139.5297, prefecture: '13' },
  '昭島市': { lat: 35.7063, lng: 139.3536, prefecture: '13' },
  '福生市': { lat: 35.7387, lng: 139.3267, prefecture: '13' },
  '羽村市': { lat: 35.7664, lng: 139.3108, prefecture: '13' },
  'あきる野市': { lat: 35.7292, lng: 139.2947, prefecture: '13' },
  '青梅市': { lat: 35.7878, lng: 139.2756, prefecture: '13' },
  '武蔵村山市': { lat: 35.7547, lng: 139.3879, prefecture: '13' },

  // ==========================================
  // 神奈川県 (14)
  // ==========================================
  '横浜市': { lat: 35.4478, lng: 139.6425, prefecture: '14' },
  '川崎市': { lat: 35.5308, lng: 139.7030, prefecture: '14' },
  '相模原市': { lat: 35.5713, lng: 139.3733, prefecture: '14' },
  '横須賀市': { lat: 35.2814, lng: 139.6722, prefecture: '14' },
  '藤沢市': { lat: 35.3390, lng: 139.4900, prefecture: '14' },
  '茅ヶ崎市': { lat: 35.3339, lng: 139.4036, prefecture: '14' },
  '平塚市': { lat: 35.3297, lng: 139.3498, prefecture: '14' },
  '厚木市': { lat: 35.4413, lng: 139.3618, prefecture: '14' },
  '大和市': { lat: 35.4677, lng: 139.4596, prefecture: '14' },
  '鎌倉市': { lat: 35.3192, lng: 139.5467, prefecture: '14' },
  '小田原市': { lat: 35.2646, lng: 139.1518, prefecture: '14' },
  '秦野市': { lat: 35.3731, lng: 139.2282, prefecture: '14' },
  '海老名市': { lat: 35.4466, lng: 139.3910, prefecture: '14' },
  '座間市': { lat: 35.4885, lng: 139.4082, prefecture: '14' },
  '伊勢原市': { lat: 35.3979, lng: 139.3137, prefecture: '14' },
  '綾瀬市': { lat: 35.4371, lng: 139.4284, prefecture: '14' },
  '逗子市': { lat: 35.2967, lng: 139.5804, prefecture: '14' },
  '三浦市': { lat: 35.1406, lng: 139.6283, prefecture: '14' },
  '南足柄市': { lat: 35.3243, lng: 139.1080, prefecture: '14' },

  // ==========================================
  // 新潟県 (15)
  // ==========================================
  '新潟市': { lat: 37.9026, lng: 139.0236, prefecture: '15' },
  '長岡市': { lat: 37.4461, lng: 138.8510, prefecture: '15' },
  '上越市': { lat: 37.1481, lng: 138.2365, prefecture: '15' },
  '三条市': { lat: 37.6369, lng: 138.9614, prefecture: '15' },
  '柏崎市': { lat: 37.3723, lng: 138.5589, prefecture: '15' },
  '燕市': { lat: 37.6731, lng: 138.8838, prefecture: '15' },

  // ==========================================
  // 富山県 (16)
  // ==========================================
  '富山市': { lat: 36.6953, lng: 137.2114, prefecture: '16' },
  '高岡市': { lat: 36.7541, lng: 137.0257, prefecture: '16' },
  '射水市': { lat: 36.7174, lng: 137.0856, prefecture: '16' },

  // ==========================================
  // 石川県 (17)
  // ==========================================
  '金沢市': { lat: 36.5946, lng: 136.6256, prefecture: '17' },
  '白山市': { lat: 36.5146, lng: 136.5654, prefecture: '17' },
  '小松市': { lat: 36.4082, lng: 136.4453, prefecture: '17' },

  // ==========================================
  // 福井県 (18)
  // ==========================================
  '福井市': { lat: 36.0652, lng: 136.2217, prefecture: '18' },
  '坂井市': { lat: 36.1700, lng: 136.2312, prefecture: '18' },
  '越前市': { lat: 35.9037, lng: 136.1701, prefecture: '18' },

  // ==========================================
  // 山梨県 (19)
  // ==========================================
  '甲府市': { lat: 35.6642, lng: 138.5684, prefecture: '19' },
  '甲斐市': { lat: 35.6746, lng: 138.5148, prefecture: '19' },
  '南アルプス市': { lat: 35.6078, lng: 138.4675, prefecture: '19' },

  // ==========================================
  // 長野県 (20)
  // ==========================================
  '長野市': { lat: 36.2321, lng: 138.1818, prefecture: '20' },
  '松本市': { lat: 36.2381, lng: 137.9720, prefecture: '20' },
  '上田市': { lat: 36.4025, lng: 138.2488, prefecture: '20' },
  '飯田市': { lat: 35.5150, lng: 137.8216, prefecture: '20' },
  '佐久市': { lat: 36.2492, lng: 138.4773, prefecture: '20' },
  '安曇野市': { lat: 36.2955, lng: 137.9065, prefecture: '20' },

  // ==========================================
  // 岐阜県 (21)
  // ==========================================
  '岐阜市': { lat: 35.3912, lng: 136.7223, prefecture: '21' },
  '大垣市': { lat: 35.3593, lng: 136.6126, prefecture: '21' },
  '各務原市': { lat: 35.3991, lng: 136.8482, prefecture: '21' },
  '多治見市': { lat: 35.3329, lng: 137.1322, prefecture: '21' },
  '可児市': { lat: 35.4261, lng: 137.0617, prefecture: '21' },
  '高山市': { lat: 36.1461, lng: 137.2523, prefecture: '21' },

  // ==========================================
  // 静岡県 (22)
  // ==========================================
  '静岡市': { lat: 34.9769, lng: 138.3831, prefecture: '22' },
  '浜松市': { lat: 34.7108, lng: 137.7262, prefecture: '22' },
  '富士市': { lat: 35.1614, lng: 138.6764, prefecture: '22' },
  '沼津市': { lat: 35.0955, lng: 138.8633, prefecture: '22' },
  '磐田市': { lat: 34.7172, lng: 137.8514, prefecture: '22' },
  '焼津市': { lat: 34.8663, lng: 138.3236, prefecture: '22' },
  '藤枝市': { lat: 34.8674, lng: 138.2572, prefecture: '22' },
  '富士宮市': { lat: 35.2219, lng: 138.6219, prefecture: '22' },
  '掛川市': { lat: 34.7688, lng: 138.0148, prefecture: '22' },
  '三島市': { lat: 35.1186, lng: 138.9183, prefecture: '22' },
  '島田市': { lat: 34.8366, lng: 138.1776, prefecture: '22' },
  '御殿場市': { lat: 35.3086, lng: 138.9347, prefecture: '22' },

  // ==========================================
  // 愛知県 (23)
  // ==========================================
  '名古屋市': { lat: 35.1802, lng: 136.9066, prefecture: '23' },
  '豊田市': { lat: 35.0832, lng: 137.1558, prefecture: '23' },
  '豊橋市': { lat: 34.7692, lng: 137.3916, prefecture: '23' },
  '岡崎市': { lat: 34.9549, lng: 137.1743, prefecture: '23' },
  '一宮市': { lat: 35.3030, lng: 136.8029, prefecture: '23' },
  '春日井市': { lat: 35.2474, lng: 136.9722, prefecture: '23' },
  '安城市': { lat: 34.9586, lng: 137.0852, prefecture: '23' },
  '豊川市': { lat: 34.8270, lng: 137.3756, prefecture: '23' },
  '西尾市': { lat: 34.8636, lng: 137.0602, prefecture: '23' },
  '刈谷市': { lat: 34.9891, lng: 137.0052, prefecture: '23' },
  '小牧市': { lat: 35.2912, lng: 136.9113, prefecture: '23' },
  '稲沢市': { lat: 35.2480, lng: 136.7848, prefecture: '23' },
  '瀬戸市': { lat: 35.2241, lng: 137.0836, prefecture: '23' },
  '半田市': { lat: 34.8930, lng: 136.9379, prefecture: '23' },
  '東海市': { lat: 34.9981, lng: 136.8948, prefecture: '23' },
  '江南市': { lat: 35.3325, lng: 136.8700, prefecture: '23' },
  '大府市': { lat: 35.0136, lng: 136.9632, prefecture: '23' },
  '知多市': { lat: 34.9637, lng: 136.8648, prefecture: '23' },
  '日進市': { lat: 35.1312, lng: 137.0398, prefecture: '23' },
  '尾張旭市': { lat: 35.2176, lng: 137.0382, prefecture: '23' },
  'みよし市': { lat: 35.0866, lng: 137.0724, prefecture: '23' },
  '蒲郡市': { lat: 34.8266, lng: 137.2217, prefecture: '23' },
  '犬山市': { lat: 35.3792, lng: 136.9442, prefecture: '23' },
  '常滑市': { lat: 34.8827, lng: 136.8359, prefecture: '23' },
  '津島市': { lat: 35.1769, lng: 136.7278, prefecture: '23' },

  // ==========================================
  // 三重県 (24)
  // ==========================================
  '津市': { lat: 34.7303, lng: 136.5086, prefecture: '24' },
  '四日市市': { lat: 34.9650, lng: 136.6244, prefecture: '24' },
  '鈴鹿市': { lat: 34.8821, lng: 136.5843, prefecture: '24' },
  '松阪市': { lat: 34.5778, lng: 136.5317, prefecture: '24' },
  '桑名市': { lat: 35.0626, lng: 136.6836, prefecture: '24' },
  '伊勢市': { lat: 34.4870, lng: 136.7259, prefecture: '24' },
  '名張市': { lat: 34.6279, lng: 136.1084, prefecture: '24' },
  '伊賀市': { lat: 34.7691, lng: 136.1310, prefecture: '24' },

  // ==========================================
  // 滋賀県 (25)
  // ==========================================
  '大津市': { lat: 35.0045, lng: 135.8686, prefecture: '25' },
  '草津市': { lat: 35.0135, lng: 135.9608, prefecture: '25' },
  '長浜市': { lat: 35.3808, lng: 136.2697, prefecture: '25' },
  '東近江市': { lat: 35.1125, lng: 136.1993, prefecture: '25' },
  '彦根市': { lat: 35.2760, lng: 136.2519, prefecture: '25' },
  '近江八幡市': { lat: 35.1290, lng: 136.0985, prefecture: '25' },
  '甲賀市': { lat: 34.9660, lng: 136.1654, prefecture: '25' },
  '守山市': { lat: 35.0583, lng: 135.9940, prefecture: '25' },

  // ==========================================
  // 京都府 (26)
  // ==========================================
  '京都市': { lat: 35.0214, lng: 135.7556, prefecture: '26' },
  '宇治市': { lat: 34.8843, lng: 135.7997, prefecture: '26' },
  '亀岡市': { lat: 35.0117, lng: 135.5775, prefecture: '26' },
  '舞鶴市': { lat: 35.4584, lng: 135.3844, prefecture: '26' },
  '城陽市': { lat: 34.8523, lng: 135.7812, prefecture: '26' },
  '長岡京市': { lat: 34.9267, lng: 135.6949, prefecture: '26' },
  '福知山市': { lat: 35.2960, lng: 135.1254, prefecture: '26' },
  '木津川市': { lat: 34.7355, lng: 135.8244, prefecture: '26' },
  '京田辺市': { lat: 34.8143, lng: 135.7679, prefecture: '26' },
  '向日市': { lat: 34.9460, lng: 135.6977, prefecture: '26' },

  // ==========================================
  // 大阪府 (27)
  // ==========================================
  '大阪市': { lat: 34.6863, lng: 135.5200, prefecture: '27' },
  '堺市': { lat: 34.5733, lng: 135.4830, prefecture: '27' },
  '東大阪市': { lat: 34.6793, lng: 135.6009, prefecture: '27' },
  '豊中市': { lat: 34.7813, lng: 135.4700, prefecture: '27' },
  '枚方市': { lat: 34.8143, lng: 135.6508, prefecture: '27' },
  '吹田市': { lat: 34.7610, lng: 135.5159, prefecture: '27' },
  '高槻市': { lat: 34.8471, lng: 135.6174, prefecture: '27' },
  '茨木市': { lat: 34.8164, lng: 135.5681, prefecture: '27' },
  '八尾市': { lat: 34.6265, lng: 135.6009, prefecture: '27' },
  '寝屋川市': { lat: 34.7663, lng: 135.6268, prefecture: '27' },
  '岸和田市': { lat: 34.4598, lng: 135.3711, prefecture: '27' },
  '和泉市': { lat: 34.4828, lng: 135.4173, prefecture: '27' },
  '守口市': { lat: 34.7354, lng: 135.5621, prefecture: '27' },
  '箕面市': { lat: 34.8269, lng: 135.4707, prefecture: '27' },
  '門真市': { lat: 34.7399, lng: 135.5876, prefecture: '27' },
  '大東市': { lat: 34.7125, lng: 135.6210, prefecture: '27' },
  '松原市': { lat: 34.5787, lng: 135.5527, prefecture: '27' },
  '富田林市': { lat: 34.5009, lng: 135.5959, prefecture: '27' },
  '羽曳野市': { lat: 34.5571, lng: 135.6069, prefecture: '27' },
  '河内長野市': { lat: 34.4574, lng: 135.5655, prefecture: '27' },
  '池田市': { lat: 34.8216, lng: 135.4349, prefecture: '27' },
  '泉大津市': { lat: 34.5052, lng: 135.4059, prefecture: '27' },
  '摂津市': { lat: 34.7722, lng: 135.5618, prefecture: '27' },
  '交野市': { lat: 34.7879, lng: 135.6800, prefecture: '27' },
  '泉佐野市': { lat: 34.4105, lng: 135.3287, prefecture: '27' },
  '藤井寺市': { lat: 34.5748, lng: 135.5974, prefecture: '27' },
  '柏原市': { lat: 34.5784, lng: 135.6293, prefecture: '27' },
  '高石市': { lat: 34.5197, lng: 135.4412, prefecture: '27' },
  '貝塚市': { lat: 34.4401, lng: 135.3570, prefecture: '27' },
  '阪南市': { lat: 34.3587, lng: 135.2451, prefecture: '27' },
  '四條畷市': { lat: 34.7411, lng: 135.6394, prefecture: '27' },
  '大阪狭山市': { lat: 34.5044, lng: 135.5565, prefecture: '27' },

  // ==========================================
  // 兵庫県 (28)
  // ==========================================
  '神戸市': { lat: 34.6913, lng: 135.1830, prefecture: '28' },
  '姫路市': { lat: 34.8153, lng: 134.6854, prefecture: '28' },
  '西宮市': { lat: 34.7378, lng: 135.3419, prefecture: '28' },
  '尼崎市': { lat: 34.7333, lng: 135.4065, prefecture: '28' },
  '明石市': { lat: 34.6432, lng: 134.9972, prefecture: '28' },
  '加古川市': { lat: 34.7567, lng: 134.8415, prefecture: '28' },
  '宝塚市': { lat: 34.7997, lng: 135.3601, prefecture: '28' },
  '伊丹市': { lat: 34.7841, lng: 135.4004, prefecture: '28' },
  '川西市': { lat: 34.8284, lng: 135.4160, prefecture: '28' },
  '三田市': { lat: 34.8893, lng: 135.2244, prefecture: '28' },
  '芦屋市': { lat: 34.7268, lng: 135.3040, prefecture: '28' },
  '高砂市': { lat: 34.7466, lng: 134.7901, prefecture: '28' },
  '豊岡市': { lat: 35.5439, lng: 134.8205, prefecture: '28' },
  'たつの市': { lat: 34.8525, lng: 134.5500, prefecture: '28' },
  '赤穂市': { lat: 34.7549, lng: 134.3899, prefecture: '28' },
  '三木市': { lat: 34.7966, lng: 134.9929, prefecture: '28' },
  '小野市': { lat: 34.8525, lng: 134.9300, prefecture: '28' },

  // ==========================================
  // 奈良県 (29)
  // ==========================================
  '奈良市': { lat: 34.6851, lng: 135.8329, prefecture: '29' },
  '橿原市': { lat: 34.5091, lng: 135.7925, prefecture: '29' },
  '生駒市': { lat: 34.6926, lng: 135.7013, prefecture: '29' },
  '大和郡山市': { lat: 34.6495, lng: 135.7829, prefecture: '29' },
  '天理市': { lat: 34.5965, lng: 135.8376, prefecture: '29' },
  '大和高田市': { lat: 34.5148, lng: 135.7355, prefecture: '29' },
  '香芝市': { lat: 34.5418, lng: 135.6969, prefecture: '29' },
  '桜井市': { lat: 34.5128, lng: 135.8434, prefecture: '29' },

  // ==========================================
  // 和歌山県 (30)
  // ==========================================
  '和歌山市': { lat: 34.2260, lng: 135.1675, prefecture: '30' },
  '田辺市': { lat: 33.7263, lng: 135.3697, prefecture: '30' },
  '橋本市': { lat: 34.3151, lng: 135.6063, prefecture: '30' },

  // ==========================================
  // 鳥取県 (31)
  // ==========================================
  '鳥取市': { lat: 35.5039, lng: 134.2383, prefecture: '31' },
  '米子市': { lat: 35.4282, lng: 133.3310, prefecture: '31' },
  '倉吉市': { lat: 35.4305, lng: 133.8246, prefecture: '31' },

  // ==========================================
  // 島根県 (32)
  // ==========================================
  '松江市': { lat: 35.4723, lng: 133.0505, prefecture: '32' },
  '出雲市': { lat: 35.3670, lng: 132.7545, prefecture: '32' },
  '浜田市': { lat: 34.8991, lng: 132.0800, prefecture: '32' },

  // ==========================================
  // 岡山県 (33)
  // ==========================================
  '岡山市': { lat: 34.6618, lng: 133.9344, prefecture: '33' },
  '倉敷市': { lat: 34.5850, lng: 133.7714, prefecture: '33' },
  '津山市': { lat: 35.0553, lng: 134.0061, prefecture: '33' },
  '総社市': { lat: 34.6721, lng: 133.7472, prefecture: '33' },

  // ==========================================
  // 広島県 (34)
  // ==========================================
  '広島市': { lat: 34.3966, lng: 132.4596, prefecture: '34' },
  '福山市': { lat: 34.4861, lng: 133.3627, prefecture: '34' },
  '呉市': { lat: 34.2468, lng: 132.5661, prefecture: '34' },
  '東広島市': { lat: 34.4268, lng: 132.7431, prefecture: '34' },
  '尾道市': { lat: 34.4090, lng: 133.2050, prefecture: '34' },
  '廿日市市': { lat: 34.3490, lng: 132.3315, prefecture: '34' },
  '三原市': { lat: 34.3986, lng: 133.0773, prefecture: '34' },

  // ==========================================
  // 山口県 (35)
  // ==========================================
  '山口市': { lat: 34.1861, lng: 131.4705, prefecture: '35' },
  '下関市': { lat: 33.9580, lng: 130.9417, prefecture: '35' },
  '周南市': { lat: 34.0559, lng: 131.8056, prefecture: '35' },
  '宇部市': { lat: 33.9516, lng: 131.2467, prefecture: '35' },
  '岩国市': { lat: 34.1669, lng: 132.2196, prefecture: '35' },
  '防府市': { lat: 34.0511, lng: 131.5627, prefecture: '35' },

  // ==========================================
  // 徳島県 (36)
  // ==========================================
  '徳島市': { lat: 34.0658, lng: 134.5593, prefecture: '36' },
  '阿南市': { lat: 33.9208, lng: 134.6598, prefecture: '36' },

  // ==========================================
  // 香川県 (37)
  // ==========================================
  '高松市': { lat: 34.3401, lng: 134.0434, prefecture: '37' },
  '丸亀市': { lat: 34.2884, lng: 133.7986, prefecture: '37' },
  '坂出市': { lat: 34.3157, lng: 133.8606, prefecture: '37' },

  // ==========================================
  // 愛媛県 (38)
  // ==========================================
  '松山市': { lat: 33.8416, lng: 132.7657, prefecture: '38' },
  '今治市': { lat: 34.0663, lng: 132.9979, prefecture: '38' },
  '新居浜市': { lat: 33.9604, lng: 133.2834, prefecture: '38' },
  '西条市': { lat: 33.9195, lng: 133.1867, prefecture: '38' },
  '四国中央市': { lat: 33.9806, lng: 133.5490, prefecture: '38' },

  // ==========================================
  // 高知県 (39)
  // ==========================================
  '高知市': { lat: 33.5597, lng: 133.5311, prefecture: '39' },
  '南国市': { lat: 33.5646, lng: 133.6311, prefecture: '39' },

  // ==========================================
  // 福岡県 (40)
  // ==========================================
  '福岡市': { lat: 33.5902, lng: 130.4017, prefecture: '40' },
  '北九州市': { lat: 33.8834, lng: 130.8751, prefecture: '40' },
  '久留米市': { lat: 33.3191, lng: 130.5083, prefecture: '40' },
  '飯塚市': { lat: 33.6462, lng: 130.6912, prefecture: '40' },
  '大牟田市': { lat: 33.0293, lng: 130.4462, prefecture: '40' },
  '春日市': { lat: 33.5326, lng: 130.4706, prefecture: '40' },
  '筑紫野市': { lat: 33.4960, lng: 130.5154, prefecture: '40' },
  '大野城市': { lat: 33.5360, lng: 130.4783, prefecture: '40' },
  '宗像市': { lat: 33.8063, lng: 130.5397, prefecture: '40' },
  '太宰府市': { lat: 33.5121, lng: 130.5242, prefecture: '40' },
  '古賀市': { lat: 33.7292, lng: 130.4693, prefecture: '40' },
  '糸島市': { lat: 33.5558, lng: 130.1975, prefecture: '40' },
  '福津市': { lat: 33.7682, lng: 130.4917, prefecture: '40' },
  '直方市': { lat: 33.7439, lng: 130.7301, prefecture: '40' },
  '田川市': { lat: 33.6365, lng: 130.8064, prefecture: '40' },
  '行橋市': { lat: 33.7286, lng: 130.9833, prefecture: '40' },
  '中間市': { lat: 33.8155, lng: 130.7118, prefecture: '40' },
  '小郡市': { lat: 33.3957, lng: 130.5566, prefecture: '40' },

  // ==========================================
  // 佐賀県 (41)
  // ==========================================
  '佐賀市': { lat: 33.2494, lng: 130.2988, prefecture: '41' },
  '唐津市': { lat: 33.4499, lng: 129.9697, prefecture: '41' },
  '鳥栖市': { lat: 33.3784, lng: 130.5237, prefecture: '41' },

  // ==========================================
  // 長崎県 (42)
  // ==========================================
  '長崎市': { lat: 32.7448, lng: 129.8737, prefecture: '42' },
  '佐世保市': { lat: 33.1593, lng: 129.7234, prefecture: '42' },
  '諫早市': { lat: 32.8420, lng: 130.0531, prefecture: '42' },
  '大村市': { lat: 32.9201, lng: 129.9587, prefecture: '42' },

  // ==========================================
  // 熊本県 (43)
  // ==========================================
  '熊本市': { lat: 32.7898, lng: 130.7417, prefecture: '43' },
  '八代市': { lat: 32.5070, lng: 130.6026, prefecture: '43' },
  '天草市': { lat: 32.4600, lng: 130.1950, prefecture: '43' },
  '玉名市': { lat: 32.9273, lng: 130.5595, prefecture: '43' },
  '合志市': { lat: 32.8854, lng: 130.7762, prefecture: '43' },

  // ==========================================
  // 大分県 (44)
  // ==========================================
  '大分市': { lat: 33.2382, lng: 131.6126, prefecture: '44' },
  '別府市': { lat: 33.2846, lng: 131.4914, prefecture: '44' },
  '中津市': { lat: 33.5983, lng: 131.1880, prefecture: '44' },

  // ==========================================
  // 宮崎県 (45)
  // ==========================================
  '宮崎市': { lat: 31.9111, lng: 131.4239, prefecture: '45' },
  '都城市': { lat: 31.7253, lng: 131.0670, prefecture: '45' },
  '延岡市': { lat: 32.5822, lng: 131.6681, prefecture: '45' },

  // ==========================================
  // 鹿児島県 (46)
  // ==========================================
  '鹿児島市': { lat: 31.5602, lng: 130.5581, prefecture: '46' },
  '霧島市': { lat: 31.7412, lng: 130.7635, prefecture: '46' },
  '薩摩川内市': { lat: 31.8135, lng: 130.3044, prefecture: '46' },
  '鹿屋市': { lat: 31.3781, lng: 130.8527, prefecture: '46' },
  '姶良市': { lat: 31.7295, lng: 130.6302, prefecture: '46' },

  // ==========================================
  // 沖縄県 (47)
  // ==========================================
  '那覇市': { lat: 26.3344, lng: 127.6809, prefecture: '47' },
  '沖縄市': { lat: 26.3342, lng: 127.8056, prefecture: '47' },
  'うるま市': { lat: 26.3792, lng: 127.8574, prefecture: '47' },
  '浦添市': { lat: 26.3458, lng: 127.7225, prefecture: '47' },
  '宜野湾市': { lat: 26.3381, lng: 127.7781, prefecture: '47' },
  '豊見城市': { lat: 26.2606, lng: 127.6684, prefecture: '47' },
  '名護市': { lat: 26.5916, lng: 127.9775, prefecture: '47' },
  '糸満市': { lat: 26.2236, lng: 127.6651, prefecture: '47' },
  '南城市': { lat: 26.2109, lng: 127.7644, prefecture: '47' },
  '南風原町': { lat: 26.2930, lng: 127.7274, prefecture: '47' },
  '西原町': { lat: 26.3400, lng: 127.7621, prefecture: '47' },
  '読谷村': { lat: 26.3966, lng: 127.7445, prefecture: '47' },
  '北谷町': { lat: 26.3268, lng: 127.7635, prefecture: '47' },
  '北中城村': { lat: 26.3383, lng: 127.7923, prefecture: '47' },
  '中城村': { lat: 26.3138, lng: 127.7873, prefecture: '47' },
  '嘉手納町': { lat: 26.3548, lng: 127.7530, prefecture: '47' },
};

// ==========================================
// C. 住所→座標変換（geocodeAddress）
// ==========================================

/**
 * Parse a Japanese address string and return approximate coordinates.
 * Matches against city names first (more precise), then falls back to prefecture name.
 *
 * @param address - 日本語住所文字列（例: "東京都世田谷区..."、"大阪府大阪市北区..."）
 * @returns 座標と信頼度、またはマッチしない場合は null
 */
export function geocodeAddress(
  address: string
): { lat: number; lng: number; confidence: 'city' | 'prefecture' | 'default' } | null {
  if (!address || address.trim().length === 0) {
    return null;
  }

  const normalizedAddress = address.trim();

  // 1. 市区町村名で照合（最も精度が高い）
  //    長い名前から先にマッチさせて「市川市」が「市」だけにマッチしないようにする
  const cityNames = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const cityName of cityNames) {
    if (normalizedAddress.includes(cityName)) {
      const coords = CITY_COORDS[cityName];
      return { lat: coords.lat, lng: coords.lng, confidence: 'city' };
    }
  }

  // 2. 都道府県名で照合（フォールバック）
  for (const code of Object.keys(PREFECTURE_DATA)) {
    const pref = PREFECTURE_DATA[code];
    if (normalizedAddress.includes(pref.name)) {
      return { lat: pref.lat, lng: pref.lng, confidence: 'prefecture' };
    }
  }

  // 3. 都道府県名の省略形で照合（「県」「府」「都」「道」なし）
  for (const code of Object.keys(PREFECTURE_DATA)) {
    const pref = PREFECTURE_DATA[code];
    const shortName = pref.name.replace(/(都|道|府|県)$/, '');
    if (shortName.length >= 2 && normalizedAddress.includes(shortName)) {
      return { lat: pref.lat, lng: pref.lng, confidence: 'prefecture' };
    }
  }

  return null;
}

// ==========================================
// D. 距離計算（Haversine formula）
// ==========================================

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 *
 * @param lat1 - 地点1の緯度
 * @param lng1 - 地点1の経度
 * @param lat2 - 地点2の緯度
 * @param lng2 - 地点2の経度
 * @returns 距離（km）
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 地球の半径（km）
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ==========================================
// E. 都道府県ヘルパー
// ==========================================

/**
 * Get the JIS X 0401 prefecture code from a prefecture name.
 *
 * @param name - 都道府県名（例: '東京都', '大阪府'）
 * @returns 都道府県コード（例: '13'）、見つからない場合は null
 */
export function getPrefectureCode(name: string): string | null {
  for (const [code, data] of Object.entries(PREFECTURE_DATA)) {
    if (data.name === name) {
      return code;
    }
  }
  // 省略形でも検索（「東京」→「東京都」）
  for (const [code, data] of Object.entries(PREFECTURE_DATA)) {
    const shortName = data.name.replace(/(都|道|府|県)$/, '');
    if (name === shortName) {
      return code;
    }
  }
  return null;
}

/**
 * Get the prefecture name from a JIS X 0401 prefecture code.
 *
 * @param code - 都道府県コード（例: '13'）
 * @returns 都道府県名（例: '東京都'）、見つからない場合は null
 */
export function getPrefectureName(code: string): string | null {
  const data = PREFECTURE_DATA[code];
  return data ? data.name : null;
}

/**
 * Sorted list of all 47 prefectures (by JIS code).
 */
export const PREFECTURE_LIST: { code: string; name: string }[] = Object.entries(PREFECTURE_DATA)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, data]) => ({ code, name: data.name }));

// ==========================================
// F. 施設タイプ定義
// ==========================================

export const FACILITY_TYPES: Record<string, string> = {
  child_development_support: '児童発達支援',
  after_school_day: '放課後等デイサービス',
  severe_disability: '重症心身障害児',
  employment_transition: '就労移行支援',
  employment_continuation_a: '就労継続支援A型',
  employment_continuation_b: '就労継続支援B型',
  residential: '障害児入所施設',
  home_care: '居宅介護',
  group_home: 'グループホーム',
  consultation_support: '相談支援',
};
