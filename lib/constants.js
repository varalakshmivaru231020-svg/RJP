const KARNATAKA_DISTRICTS = [
  'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar',
  'Chamarajanagar', 'Chikballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada',
  'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar',
  'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru',
  'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir', 'Vijayanagara'
];

const AREAS_OF_INTEREST = [
  'Youth Wing', 'Women Wing', 'IT & Social Media Cell', 'Booth Level Work',
  'Volunteering', 'Fundraising', 'Legal Cell', 'Farmers Wing', 'Student Wing'
];

const STATUS_ORDER = ['Pending Approval', 'Under Review', 'Approved', 'Active'];
const ALL_STATUSES = [...STATUS_ORDER, 'Rejected'];

const PAYMENT_FEE_AMOUNT = 100;
const PAYMENT_STATUSES = ['Not Paid', 'Submitted', 'Verified', 'Rejected'];

// Best-effort taluk list per district (post-2021 reorganization). District
// boundaries have shifted in recent years (e.g. Vijayanagara split from
// Ballari) — verify against the current official gazette before relying on
// this for anything beyond a form dropdown.
const KARNATAKA_TALUKS = {
  'Bagalkot': ['Bagalkot', 'Badami', 'Bilagi', 'Hunagund', 'Jamakhandi', 'Mudhol', 'Rabakavi Banahatti', 'Guledgudda'],
  'Ballari': ['Ballari', 'Kampli', 'Sandur', 'Siruguppa', 'Kurugodu'],
  'Belagavi': ['Belagavi', 'Athani', 'Bailhongal', 'Chikkodi', 'Gokak', 'Hukkeri', 'Khanapur', 'Kittur', 'Mudalgi', 'Nippani', 'Ramdurg', 'Raybag', 'Saundatti', 'Yaragatti', 'Kagwad'],
  'Bengaluru Rural': ['Doddaballapura', 'Devanahalli', 'Hoskote', 'Nelamangala'],
  'Bengaluru Urban': ['Bengaluru North', 'Bengaluru South', 'Bengaluru East', 'Anekal', 'Yelahanka'],
  'Bidar': ['Bidar', 'Aurad', 'Basavakalyan', 'Bhalki', 'Humnabad', 'Chitguppa'],
  'Chamarajanagar': ['Chamarajanagar', 'Gundlupet', 'Kollegal', 'Yelandur', 'Hanur'],
  'Chikballapur': ['Chikballapur', 'Bagepalli', 'Chintamani', 'Gauribidanur', 'Gudibande', 'Sidlaghatta'],
  'Chikkamagaluru': ['Chikkamagaluru', 'Kadur', 'Koppa', 'Mudigere', 'Narasimharajapura', 'Sringeri', 'Tarikere', 'Ajjampura'],
  'Chitradurga': ['Chitradurga', 'Challakere', 'Hiriyur', 'Holalkere', 'Hosadurga', 'Molakalmuru'],
  'Dakshina Kannada': ['Mangaluru', 'Bantwal', 'Belthangady', 'Puttur', 'Sullia', 'Moodbidri', 'Kadaba'],
  'Davanagere': ['Davanagere', 'Channagiri', 'Harihar', 'Honnali', 'Jagalur', 'Nyamathi'],
  'Dharwad': ['Dharwad', 'Hubballi', 'Kalghatgi', 'Kundgol', 'Navalgund', 'Annigeri'],
  'Gadag': ['Gadag', 'Mundargi', 'Nargund', 'Ron', 'Shirahatti', 'Gajendragad'],
  'Hassan': ['Hassan', 'Alur', 'Arkalgud', 'Arsikere', 'Belur', 'Channarayapatna', 'Holenarasipura', 'Sakleshpur'],
  'Haveri': ['Haveri', 'Byadgi', 'Hangal', 'Hirekerur', 'Ranebennur', 'Savanur', 'Shiggaon'],
  'Kalaburagi': ['Kalaburagi', 'Afzalpur', 'Aland', 'Chincholi', 'Chittapur', 'Jevargi', 'Sedam', 'Kamalapur'],
  'Kodagu': ['Madikeri', 'Somwarpet', 'Virajpet', 'Kushalnagar'],
  'Kolar': ['Kolar', 'Bangarpet', 'Malur', 'Mulbagal', 'Srinivaspur'],
  'Koppal': ['Koppal', 'Gangavathi', 'Kushtagi', 'Yelbarga', 'Karatagi'],
  'Mandya': ['Mandya', 'Krishnarajpet', 'Maddur', 'Malavalli', 'Nagamangala', 'Pandavapura', 'Srirangapatna'],
  'Mysuru': ['Mysuru', 'Hunsur', 'Krishnarajanagara', 'Nanjangud', 'Periyapatna', 'Saligrama', 'Tirumakudalu Narasipura', 'H.D. Kote'],
  'Raichur': ['Raichur', 'Devadurga', 'Lingasugur', 'Manvi', 'Sindhanur', 'Sirwar'],
  'Ramanagara': ['Ramanagara', 'Channapatna', 'Kanakapura', 'Magadi'],
  'Shivamogga': ['Shivamogga', 'Bhadravathi', 'Hosanagara', 'Sagara', 'Shikaripura', 'Sorab', 'Thirthahalli'],
  'Tumakuru': ['Tumakuru', 'Chikkanayakanahalli', 'Gubbi', 'Koratagere', 'Kunigal', 'Madhugiri', 'Pavagada', 'Sira', 'Tiptur', 'Turuvekere'],
  'Udupi': ['Udupi', 'Karkala', 'Kundapura', 'Byndoor'],
  'Uttara Kannada': ['Karwar', 'Ankola', 'Bhatkal', 'Dandeli', 'Haliyal', 'Honnavar', 'Joida', 'Kumta', 'Mundgod', 'Siddapur', 'Sirsi', 'Yellapur'],
  'Vijayapura': ['Vijayapura', 'Basavana Bagewadi', 'Chadchan', 'Indi', 'Muddebihal', 'Sindagi', 'Devar Hippargi'],
  'Yadgir': ['Yadgir', 'Shahapur', 'Shorapur', 'Gurmitkal'],
  'Vijayanagara': ['Hosapete', 'Hagaribommanahalli', 'Harapanahalli', 'Hoovina Hadagali', 'Kottur', 'Kudligi']
};

module.exports = {
  KARNATAKA_DISTRICTS, AREAS_OF_INTEREST, STATUS_ORDER, ALL_STATUSES,
  PAYMENT_FEE_AMOUNT, PAYMENT_STATUSES, KARNATAKA_TALUKS
};
