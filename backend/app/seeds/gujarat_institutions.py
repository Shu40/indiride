"""
Comprehensive Seed Data for Gujarat Educational Institutions
Includes Universities (Government & Private), Premier Autonomous Institutes,
Colleges (Engineering, Medical, Commerce, Science), and Top Senior Secondary Schools.
"""

from typing import List, Dict

GUJARAT_INSTITUTIONS: List[Dict[str, str]] = [
    # Top Universities (Public & Private)
    {"name": "Parul University", "short_name": "PU", "city": "Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "Maharaja Sayajirao University of Baroda (MSU)", "short_name": "MSU", "city": "Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "Gujarat University", "short_name": "GU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Gujarat Technological University (GTU)", "short_name": "GTU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Sardar Patel University (SPU)", "short_name": "SPU", "city": "Vallabh Vidyanagar, Anand", "state": "Gujarat", "type": "University"},
    {"name": "Saurashtra University", "short_name": "SU", "city": "Rajkot", "state": "Gujarat", "type": "University"},
    {"name": "Veer Narmad South Gujarat University (VNSGU)", "short_name": "VNSGU", "city": "Surat", "state": "Gujarat", "type": "University"},
    {"name": "Hemchandracharya North Gujarat University (HNGU)", "short_name": "HNGU", "city": "Patan", "state": "Gujarat", "type": "University"},
    {"name": "Maharaja Krishnakumarsinhji Bhavnagar University (MKBU)", "short_name": "MKBU", "city": "Bhavnagar", "state": "Gujarat", "type": "University"},
    {"name": "KSKV Kachchh University", "short_name": "KU", "city": "Bhuj", "state": "Gujarat", "type": "University"},
    {"name": "IIT Gandhinagar (Indian Institute of Technology)", "short_name": "IITGN", "city": "Gandhinagar", "state": "Gujarat", "type": "Institute"},
    {"name": "IIM Ahmedabad (Indian Institute of Management)", "short_name": "IIMA", "city": "Ahmedabad", "state": "Gujarat", "type": "Institute"},
    {"name": "SVNIT Surat (Sardar Vallabhbhai National Institute of Technology)", "short_name": "SVNIT", "city": "Surat", "state": "Gujarat", "type": "Institute"},
    {"name": "Nirma University", "short_name": "Nirma", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Dhirubhai Ambani Institute of Information and Communication Technology (DA-IICT)", "short_name": "DA-IICT", "city": "Gandhinagar", "state": "Gujarat", "type": "Institute"},
    {"name": "Pandit Deendayal Energy University (PDEU / PDPU)", "short_name": "PDEU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "Charotar University of Science and Technology (CHARUSAT)", "short_name": "CHARUSAT", "city": "Changa, Anand", "state": "Gujarat", "type": "University"},
    {"name": "Dharmsinh Desai University (DDU)", "short_name": "DDU", "city": "Nadiad", "state": "Gujarat", "type": "University"},
    {"name": "Navrachana University (NUV)", "short_name": "NUV", "city": "Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "Marwadi University", "short_name": "MU", "city": "Rajkot", "state": "Gujarat", "type": "University"},
    {"name": "Silver Oak University", "short_name": "SOU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Ahmedabad University", "short_name": "AU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Ganpat University (GUNI)", "short_name": "GUNI", "city": "Kherva, Mehsana", "state": "Gujarat", "type": "University"},
    {"name": "Karnavati University", "short_name": "KU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "GLS University (Gujarat Law Society)", "short_name": "GLS", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Indus University", "short_name": "Indus", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "GSFC University", "short_name": "GSFCU", "city": "Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "ITM (SLS) Baroda University", "short_name": "ITMBU", "city": "Paldi, Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "P.P. Savani University", "short_name": "PPSU", "city": "Kosamba, Surat", "state": "Gujarat", "type": "University"},
    {"name": "Uka Tarsadia University (UTU)", "short_name": "UTU", "city": "Bardoli, Surat", "state": "Gujarat", "type": "University"},
    {"name": "National Forensic Sciences University (NFSU)", "short_name": "NFSU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "Rashtriya Raksha University (RRU)", "short_name": "RRU", "city": "Lavad, Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "Gujarat National Law University (GNLU)", "short_name": "GNLU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "IIIT Vadodara (Indian Institute of Information Technology)", "short_name": "IIITV", "city": "Vadodara", "state": "Gujarat", "type": "Institute"},
    {"name": "IIIT Surat (Indian Institute of Information Technology)", "short_name": "IIITS", "city": "Surat", "state": "Gujarat", "type": "Institute"},
    {"name": "NID Ahmedabad (National Institute of Design)", "short_name": "NID", "city": "Ahmedabad", "state": "Gujarat", "type": "Institute"},
    {"name": "NIFT Gandhinagar (National Institute of Fashion Technology)", "short_name": "NIFT", "city": "Gandhinagar", "state": "Gujarat", "type": "Institute"},
    {"name": "AIIMS Rajkot (All India Institute of Medical Sciences)", "short_name": "AIIMS", "city": "Rajkot", "state": "Gujarat", "type": "Institute"},
    {"name": "CEPT University", "short_name": "CEPT", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Anand Agricultural University (AAU)", "short_name": "AAU", "city": "Anand", "state": "Gujarat", "type": "University"},
    {"name": "Junagadh Agricultural University (JAU)", "short_name": "JAU", "city": "Junagadh", "state": "Gujarat", "type": "University"},
    {"name": "Navsari Agricultural University (NAU)", "short_name": "NAU", "city": "Navsari", "state": "Gujarat", "type": "University"},
    {"name": "Sardarkrushinagar Dantiwada Agricultural University (SDAU)", "short_name": "SDAU", "city": "Dantiwada, Banaskantha", "state": "Gujarat", "type": "University"},
    {"name": "Kamdhenu University", "short_name": "KU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "Atmiya University", "short_name": "Atmiya", "city": "Rajkot", "state": "Gujarat", "type": "University"},
    {"name": "RK University", "short_name": "RKU", "city": "Rajkot", "state": "Gujarat", "type": "University"},
    {"name": "C.U. Shah University", "short_name": "CUSU", "city": "Wadhwan, Surendranagar", "state": "Gujarat", "type": "University"},
    {"name": "Swarrnim Startup & Innovation University", "short_name": "SSIU", "city": "Gandhinagar", "state": "Gujarat", "type": "University"},
    {"name": "Sankalchand Patel University", "short_name": "SPU", "city": "Visnagar, Mehsana", "state": "Gujarat", "type": "University"},
    {"name": "Rai University", "short_name": "RU", "city": "Dholka, Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "Gokul Global University", "short_name": "GGU", "city": "Sidhpur, Patan", "state": "Gujarat", "type": "University"},
    {"name": "Shri Govind Guru University (SGGU)", "short_name": "SGGU", "city": "Godhra, Panchmahal", "state": "Gujarat", "type": "University"},
    {"name": "Bhakta Kavi Narsinh Mehta University (BKNMU)", "short_name": "BKNMU", "city": "Junagadh", "state": "Gujarat", "type": "University"},
    {"name": "Dr. Babasaheb Ambedkar Open University (BAOU)", "short_name": "BAOU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "TeamLease Skills University", "short_name": "TLSU", "city": "Tarsali, Vadodara", "state": "Gujarat", "type": "University"},
    {"name": "Anant National University", "short_name": "ANU", "city": "Ahmedabad", "state": "Gujarat", "type": "University"},
    {"name": "IRMA (Institute of Rural Management Anand)", "short_name": "IRMA", "city": "Anand", "state": "Gujarat", "type": "Institute"},
    {"name": "MICA Ahmedabad", "short_name": "MICA", "city": "Shela, Ahmedabad", "state": "Gujarat", "type": "Institute"},
    {"name": "EDI India (Entrepreneurship Development Institute)", "short_name": "EDII", "city": "Bhat, Gandhinagar", "state": "Gujarat", "type": "Institute"},

    # Top Colleges & Institutes
    {"name": "BITS Edu Campus (Babaria Institute)", "short_name": "BITS", "city": "Varnama, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "Vadodara Institute of Engineering & Research (VIER)", "short_name": "VIER", "city": "Kotambi, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "ITM Universe Campus", "short_name": "ITM", "city": "Jarod, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "Sigma Group of Institutes", "short_name": "Sigma", "city": "Bakrol, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "Neotech Institute of Technology", "short_name": "NIT", "city": "Virod, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "L.D. College of Engineering (LDCE)", "short_name": "LDCE", "city": "Navrangpura, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "Vishwakarma Government Engineering College (VGEC)", "short_name": "VGEC", "city": "Chandkheda, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "Birla Vishvakarma Mahavidyalaya (BVM Engineering College)", "short_name": "BVM", "city": "Vallabh Vidyanagar, Anand", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Gandhinagar", "short_name": "GECG", "city": "Gandhinagar", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Rajkot", "short_name": "GECR", "city": "Rajkot", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Bhavnagar", "short_name": "GECB", "city": "Bhavnagar", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Surat", "short_name": "GECS", "city": "Surat", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Modasa", "short_name": "GECM", "city": "Modasa, Aravalli", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Dahod", "short_name": "GECD", "city": "Dahod", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Patan", "short_name": "GECP", "city": "Patan", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Bharuch", "short_name": "GECBH", "city": "Bharuch", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Godhra", "short_name": "GECGD", "city": "Godhra", "state": "Gujarat", "type": "College"},
    {"name": "Government Engineering College (GEC) Valsad", "short_name": "GECV", "city": "Valsad", "state": "Gujarat", "type": "College"},
    {"name": "Baroda Medical College & SSG Hospital", "short_name": "BMC", "city": "Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "B.J. Medical College & Civil Hospital", "short_name": "BJMC", "city": "Asarwa, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "Government Medical College (GMC) Surat", "short_name": "GMCS", "city": "Surat", "state": "Gujarat", "type": "College"},
    {"name": "Pandit Deendayal Upadhyay Medical College (PDU)", "short_name": "PDUMC", "city": "Rajkot", "state": "Gujarat", "type": "College"},
    {"name": "M.P. Shah Government Medical College", "short_name": "MPSMC", "city": "Jamnagar", "state": "Gujarat", "type": "College"},
    {"name": "GMERS Medical College Gotri", "short_name": "GMERS-G", "city": "Gotri, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "GMERS Medical College Sola", "short_name": "GMERS-S", "city": "Sola, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "GMERS Medical College Gandhinagar", "short_name": "GMERS-GN", "city": "Gandhinagar", "state": "Gujarat", "type": "College"},
    {"name": "St. Xavier's College", "short_name": "SXC", "city": "Navrangpura, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "M.G. Science Institute", "short_name": "MGSI", "city": "Navrangpura, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "H.L. College of Commerce", "short_name": "HLCC", "city": "Navrangpura, Ahmedabad", "state": "Gujarat", "type": "College"},
    {"name": "Faculty of Technology & Engineering (FTE - MSU)", "short_name": "FTE-MSU", "city": "Kalabhavan, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "Faculty of Science & Arts (MSU)", "short_name": "MSU-Sci", "city": "Sayajigunj, Vadodara", "state": "Gujarat", "type": "College"},
    {"name": "Sir P.T. Sarvajanik College of Science", "short_name": "PT-Science", "city": "Athwalines, Surat", "state": "Gujarat", "type": "College"},
    {"name": "V.P. & R.P.T.P. Science College", "short_name": "VP-Science", "city": "Vallabh Vidyanagar, Anand", "state": "Gujarat", "type": "College"},
    {"name": "Dharmendrasinhji Arts College", "short_name": "DAC", "city": "Yagnik Road, Rajkot", "state": "Gujarat", "type": "College"},

    # Top Schools & Senior Secondary Campuses
    {"name": "Delhi Public School (DPS) Kalali", "short_name": "DPS Kalali", "city": "Kalali, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) Harni", "short_name": "DPS Harni", "city": "Harni, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) Bopal", "short_name": "DPS Bopal", "city": "Bopal, Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) East Ahmedabad", "short_name": "DPS East", "city": "Hirapur, Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) Surat", "short_name": "DPS Surat", "city": "Dumas Road, Surat", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) Gandhinagar", "short_name": "DPS Gandhinagar", "city": "Koba, Gandhinagar", "state": "Gujarat", "type": "School"},
    {"name": "Delhi Public School (DPS) Rajkot", "short_name": "DPS Rajkot", "city": "Kalawad Road, Rajkot", "state": "Gujarat", "type": "School"},
    {"name": "Navrachana School Sama", "short_name": "Navrachana Sama", "city": "Sama, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Navrachana International School Bhayli", "short_name": "Navrachana Bhayli", "city": "Bhayli, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Baroda High School (Alkapuri & ONGC)", "short_name": "BHS", "city": "Alkapuri, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Bright Day School (Vasna & Harni)", "short_name": "Bright Day", "city": "Vasna-Bhayli, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Kendriya Vidyalaya (KV EME & Harni)", "short_name": "KV Baroda", "city": "Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Kendriya Vidyalaya (KV SAC & Cantt)", "short_name": "KV Ahmedabad", "city": "Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "Udgam School for Children", "short_name": "Udgam", "city": "Thaltej, Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "The Riverside School", "short_name": "Riverside", "city": "Cantonment, Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "Anand Niketan School (Shilaj & Satellite)", "short_name": "Anand Niketan", "city": "Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "Zydus School for Excellence", "short_name": "Zydus School", "city": "Godhavi, Ahmedabad", "state": "Gujarat", "type": "School"},
    {"name": "The Rajkumar College (RKC)", "short_name": "RKC", "city": "Dr. Radhakrishnan Marg, Rajkot", "state": "Gujarat", "type": "School"},
    {"name": "S.N. Kansagra School", "short_name": "SNK", "city": "University Road, Rajkot", "state": "Gujarat", "type": "School"},
    {"name": "Tapti Valley International School", "short_name": "Tapti Valley", "city": "Olpad, Surat", "state": "Gujarat", "type": "School"},
    {"name": "J.H. Ambani Saraswati Vidyamandir", "short_name": "JHA School", "city": "Vesu, Surat", "state": "Gujarat", "type": "School"},
    {"name": "Essar International School", "short_name": "Essar School", "city": "Hazira, Surat", "state": "Gujarat", "type": "School"},
    {"name": "Gujarat Public School (GPS)", "short_name": "GPS", "city": "Atladara, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Cygnus World School", "short_name": "Cygnus", "city": "Harni, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Vibgyor High School", "short_name": "Vibgyor", "city": "Padra Road, Vadodara", "state": "Gujarat", "type": "School"},
    {"name": "Podar International School", "short_name": "Podar", "city": "Vadodara / Ahmedabad", "state": "Gujarat", "type": "School"},
]


def seed_gujarat_institutions(db):
    """
    Seeds all Gujarat universities, colleges, and schools into the University table if not already present.
    """
    from app.models.campus import University
    import uuid

    existing_names = {u[0].lower() for u in db.query(University.name).all()}
    to_add = []

    for item in GUJARAT_INSTITUTIONS:
        name = item["name"].strip()
        if name.lower() not in existing_names:
            uni = University(
                id=str(uuid.uuid4()),
                name=name,
                short_name=item.get("short_name"),
                city=item.get("city", "Gujarat"),
                state=item.get("state", "Gujarat"),
                country="India",
                status="ACTIVE"
            )
            to_add.append(uni)
            existing_names.add(name.lower())

    if to_add:
        db.add_all(to_add)
        db.commit()
