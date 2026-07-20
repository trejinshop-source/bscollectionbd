// bscollectionbd — product & location data
const PRODUCTS = [
  {
    id: 'jy2218',
    slug: 'jysuper-jy-2218-rechargeable-fan',
    name: 'JYSUPER JY-2218 Rechargeable Fan',
    price: 2200,
    old: 2500,
    image: 'assets/photo_2026-07-15_18-28-56.png',
    category: 'Rechargeable Fan',
    brand: 'JYSUPER',
    available: true,
    short: '12-inch high-airflow rechargeable table & stand fan with LED light, USB charging and long backup.',
    specs: {
      'Model': 'JY-2218',
      'Brand': 'JYSUPER',
      'Blade Size': '12 inch',
      'Battery': '6V / 4.5Ah rechargeable',
      'Backup Time': 'Up to 8 hours',
      'Charging Time': '6-8 hours',
      'LED Light': 'Built-in bright LED panel',
      'Speed Levels': '3 speeds',
      'Power Input': '220V AC / DC / USB',
      'Warranty': '6 months service warranty'
    },
    features: [
      'Powerful 12-inch blade for strong airflow',
      'Rechargeable battery — up to 8 hours backup',
      'Built-in LED panel for emergency light',
      'Three-speed control with air oscillation',
      'Charge via AC power or USB adapter',
      'Compact table-and-stand design'
    ]
  },
  {
    id: 'jy2570',
    slug: 'jy-2570-rechargeable-fan',
    name: 'JY-2570 Rechargeable Fan',
    price: 2150,
    old: 2550,
    image: 'assets/photo_2026-07-15_18-29-17.png',
    category: 'Rechargeable Fan',
    brand: 'JYSUPER',
    available: true,
    short: 'Premium rechargeable fan with high-capacity battery, remote control and dual LED light bar.',
    specs: {
      'Model': 'JY-2570',
      'Brand': 'JYSUPER',
      'Blade Size': '14 inch',
      'Battery': '6V / 7Ah high capacity',
      'Backup Time': 'Up to 12 hours',
      'Charging Time': '8-10 hours',
      'LED Light': 'Dual LED bar with dimmer',
      'Speed Levels': '4 speeds',
      'Power Input': '220V AC / Solar compatible',
      'Remote Control': 'Included',
      'Warranty': '6 months service warranty'
    },
    features: [
      '14-inch wide blade with strong airflow',
      'High-capacity 7Ah battery — up to 12 hours',
      'Includes wireless remote control',
      'Dual LED light bar with dimmer switch',
      'Compatible with solar charging',
      'Sturdy metal-reinforced base'
    ]
  },
  { id:'p3', name:'JY-Super Ceiling Fan 56"', price:0, image:'', available:false, category:'Ceiling Fan' },
  { id:'p4', name:'Industrial Stand Fan 20"', price:0, image:'', available:false, category:'Industrial Fan' },
  { id:'p5', name:'Wall Mount Fan 16"', price:0, image:'', available:false, category:'Wall Fan' },
  { id:'p6', name:'Table Fan 12" Deluxe', price:0, image:'', available:false, category:'Table Fan' },
  { id:'p7', name:'Rechargeable Emergency Light', price:0, image:'', available:false, category:'Light' },
  { id:'p8', name:'USB Mini Fan', price:0, image:'', available:false, category:'Mini Fan' }
];

// Bangladesh: divisions -> districts
const LOCATIONS = {
  'Dhaka': ['Dhaka','Faridpur','Gazipur','Gopalganj','Kishoreganj','Madaripur','Manikganj','Munshiganj','Narayanganj','Narsingdi','Rajbari','Shariatpur','Tangail'],
  'Chattogram': ['Bandarban','Brahmanbaria','Chandpur','Chattogram','Cumilla',"Cox's Bazar",'Feni','Khagrachhari','Lakshmipur','Noakhali','Rangamati'],
  'Rajshahi': ['Bogura','Chapainawabganj','Joypurhat','Naogaon','Natore','Pabna','Rajshahi','Sirajganj'],
  'Khulna': ['Bagerhat','Chuadanga','Jashore','Jhenaidah','Khulna','Kushtia','Magura','Meherpur','Narail','Satkhira'],
  'Barishal': ['Barguna','Barishal','Bhola','Jhalokathi','Patuakhali','Pirojpur'],
  'Sylhet': ['Habiganj','Moulvibazar','Sunamganj','Sylhet'],
  'Rangpur': ['Dinajpur','Gaibandha','Kurigram','Lalmonirhat','Nilphamari','Panchagarh','Rangpur','Thakurgaon'],
  'Mymensingh': ['Jamalpur','Mymensingh','Netrokona','Sherpur']
};

const DELIVERY = { 'Dhaka': 70, OTHER: 130 };

function findProduct(id){ return PRODUCTS.find(p => p.id === id); }
