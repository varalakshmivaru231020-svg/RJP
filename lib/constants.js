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

module.exports = { KARNATAKA_DISTRICTS, AREAS_OF_INTEREST, STATUS_ORDER, ALL_STATUSES };
