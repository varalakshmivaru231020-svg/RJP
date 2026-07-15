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

// Karnataka's 28 Lok Sabha (Parliament) constituencies — stable, well-documented list.
const KARNATAKA_PARLIAMENT_CONSTITUENCIES = [
  'Chikkodi', 'Belagavi', 'Bagalkot', 'Bijapur', 'Gulbarga', 'Raichur', 'Bidar', 'Koppal',
  'Bellary', 'Haveri', 'Dharwad', 'Uttara Kannada', 'Davanagere', 'Shimoga',
  'Udupi Chikmagalur', 'Hassan', 'Dakshina Kannada', 'Chitradurga', 'Tumkur', 'Mandya',
  'Mysore', 'Chamarajanagar', 'Bengaluru Rural', 'Bengaluru North', 'Bengaluru Central',
  'Bengaluru South', 'Chikballapur', 'Kolar'
];

// Karnataka's 224 Vidhana Sabha (Assembly) constituencies (2008 delimitation).
// This is a large, easy-to-get-wrong list reconstructed from general
// knowledge, NOT pulled from an official ECI source at build time — verify
// against the Election Commission's current constituency list before
// treating this as authoritative for anything beyond a convenience dropdown.
const KARNATAKA_ASSEMBLY_CONSTITUENCIES = [
  'Nippani', 'Chikkodi-Sadalga', 'Athani', 'Kagwad', 'Kudachi', 'Raibag', 'Hukkeri', 'Arabhavi',
  'Gokak', 'Yemkanmardi', 'Belagavi Uttar', 'Belagavi Dakshin', 'Belagavi Rural', 'Bailhongal',
  'Saundatti Yellamma', 'Ramdurg', 'Kittur', 'Bagalkot', 'Badami', 'Bilagi', 'Hunagund',
  'Jamakhandi', 'Terdal', 'Muddebihal', 'Devar Hippargi', 'Basavana Bagevadi', 'Babaleshwar',
  'Vijayapura City', 'Nagathan', 'Indi', 'Sindagi', 'Aurad', 'Bhalki', 'Bidar', 'Bidar South',
  'Humnabad', 'Basavakalyan', 'Chincholi', 'Sedam', 'Chittapur', 'Afzalpur', 'Jevargi', 'Gulbarga Rural',
  'Gulbarga South', 'Gulbarga North', 'Aland', 'Kamalapur', 'Shorapur', 'Shahapur', 'Yadgir',
  'Gurmitkal', 'Raichur Rural', 'Manvi', 'Devadurga', 'Raichur', 'Lingsugur', 'Sindhanur', 'Maski',
  'Kushtagi', 'Kanakagiri', 'Gangavathi', 'Yelaburga', 'Koppal', 'Sirguppa', 'Kampli', 'Vijayanagara',
  'Hospet', 'Hadagalli', 'Harapanahalli', 'Ballari City', 'Ballari Rural', 'Kudligi', 'Molakalmuru',
  'Chitradurga', 'Challakere', 'Hiriyur', 'Hosadurga', 'Holalkere', 'Channagiri', 'Davanagere North',
  'Davanagere South', 'Mayakonda', 'Harihar', 'Jagalur', 'Byadgi', 'Hangal', 'Haveri', 'Hirekerur',
  'Ranebennur', 'Shiggaon', 'Savanur', 'Kalghatgi', 'Dharwad', 'Hubli-Dharwad East', 'Hubli-Dharwad Central',
  'Hubli-Dharwad West', 'Navalgund', 'Kundgol', 'Gadag', 'Ron', 'Nargund', 'Shirahatti',
  'Karwar', 'Kumta', 'Bhatkal', 'Sirsi', 'Yellapur', 'Mundgod', 'Haliyal',
  'Sagar', 'Shivamogga Rural', 'Bhadravathi', 'Shivamogga', 'Tirthahalli', 'Shikaripura', 'Soraba',
  'Udupi', 'Kaup', 'Kundapura', 'Byndoor', 'Karkala', 'Sringeri', 'Mudigere', 'Chikmagalur',
  'Tarikere', 'Kadur', 'Belur', 'Chikkamagaluru', 'Hassan', 'Holenarasipura', 'Arsikere', 'Arkalgud',
  'Sakleshpur', 'Mangalore City North', 'Mangalore City South', 'Mangalore', 'Moodabidri', 'Bantval',
  'Puttur', 'Sullia', 'Belthangady', 'Madikeri', 'Virajpet', 'Somwarpet', 'Periyapatna', 'Krishnarajanagara',
  'Hunsur', 'H.D. Kote', 'Nanjangud', 'Chamundeshwari', 'Krishnaraja', 'Chamaraja', 'Narasimharaja',
  'Varuna', 'T. Narasipura', 'Gundlupet', 'Kollegal', 'Hanur', 'Chamarajanagar', 'Yelandur',
  'Malavalli', 'Maddur', 'Melukote', 'Mandya', 'Shrirangapattana', 'Nagamangala', 'Krishnarajpet',
  'Shravanabelagola', 'Arasikere', 'Channarayapatna', 'Somanathapura', 'Pandavapura', 'Magadi',
  'Ramanagara', 'Kanakapura', 'Channapatna', 'Rajarajeshwari Nagar', 'Bengaluru South', 'Padmanaba Nagar',
  'B.T.M. Layout', 'Jayanagar', 'Basavanagudi', 'Chickpet', 'Gandhi Nagar', 'Rajaji Nagar', 'Govindraj Nagar',
  'Vijay Nagar', 'Chamrajpet', 'Yeshwanthpur', 'Malleshwaram', 'Hebbal', 'Pulakeshi Nagar', 'Sarvagnanagar',
  'C.V. Raman Nagar', 'Shivajinagar', 'Shanti Nagar', 'Mahadevapura', 'K.R. Puram',
  'Byatarayanapura', 'Yelahanka', 'Dasarahalli', 'Bommanahalli', 'Bangalore South', 'Anekal',
  'Hoskote', 'Devanahalli', 'Doddaballapura', 'Nelamangala', 'Chikkaballapur', 'Sidlaghatta', 'Bagepalli',
  'Gauribidanur', 'Gudibande', 'Chintamani', 'Srinivaspur', 'Mulbagal', 'K.G.F.', 'Bangarapet',
  'Kolar', 'Malur', 'Sira', 'Pavagada', 'Madhugiri', 'Koratagere', 'Gubbi', 'Tumkur City', 'Tumkur Rural',
  'Chiknayakanhalli', 'Turuvekere', 'Kunigal', 'Tiptur'
];

module.exports = {
  KARNATAKA_DISTRICTS, AREAS_OF_INTEREST, STATUS_ORDER, ALL_STATUSES,
  PAYMENT_FEE_AMOUNT, PAYMENT_STATUSES, KARNATAKA_TALUKS,
  KARNATAKA_PARLIAMENT_CONSTITUENCIES, KARNATAKA_ASSEMBLY_CONSTITUENCIES
};
