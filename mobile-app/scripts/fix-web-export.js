const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');
const nodeModulesInAssets = path.join(distDir, 'assets', 'node_modules');
const expoModulesInAssets = path.join(distDir, 'assets', 'expo_modules');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy all public assets (photos, sitemaps, robots.txt, videos) to dist
if (fs.existsSync(publicDir)) {
  console.log('[fix-web-export] Syncing public assets to dist...');
  copyDirRecursive(publicDir, distDir);
}

// 2. Copy assets/node_modules to assets/expo_modules so Vercel does not ignore fonts
if (fs.existsSync(nodeModulesInAssets)) {
  console.log('[fix-web-export] Copying assets/node_modules to assets/expo_modules so Vercel does not ignore fonts...');
  copyDirRecursive(nodeModulesInAssets, expoModulesInAssets);
}

// 3. Replace font paths in all exported JS/HTML
function replaceInDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      replaceInDir(fullPath);
    } else if (/\.(js|html|json)$/.test(item.name)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('/assets/node_modules/')) {
        content = content.replace(/\/assets\/node_modules\//g, '/assets/expo_modules/');
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}
replaceInDir(distDir);

// 4. Inject Masterclass SEO Metadata into index.html and 200.html
const indexHtmlPath = path.join(distDir, 'index.html');
const twoHundredPath = path.join(distDir, '200.html');
const redirectsPath = path.join(distDir, '_redirects');

const masterSeoSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://indiride-web.vercel.app/#website",
      "url": "https://indiride-web.vercel.app/",
      "name": "IndiRide",
      "alternateName": ["Indi Ride", "indiride", "indi ride", "IndiRide Bihar", "IndiRide App"],
      "description": "Bihar's own smart ride-hailing network offering transparent per-km bike taxi (₹7/km), auto (₹10/km), and cab (₹15/km) rides. Founded by Shubham Kumar.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://indiride-web.vercel.app/login?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://indiride-web.vercel.app/#application",
      "name": "IndiRide",
      "alternateName": ["Indi Ride", "indiride", "indi ride"],
      "operatingSystem": "Web, Android, iOS, Windows, Mac, Linux",
      "applicationCategory": "TravelApplication",
      "featureList": [
        "Instant Mobile OTP Login",
        "Passenger & Driver Partner Sign Up",
        "Affordable Bike Taxi at ₹7/km",
        "Auto Rickshaw Booking at ₹10/km",
        "Cab & Car Booking at ₹15/km",
        "Campus Rides & Student Carpooling",
        "Real-Time Live GPS Driver Tracking",
        "Verified Driver Partners",
        "4-Digit Pickup Safety PIN Verification",
        "Zero Surge Pricing",
        "24x7 Customer Support"
      ],
      "offers": {
        "@type": "Offer",
        "price": "7.00",
        "priceCurrency": "INR"
      },
      "screenshot": "https://indiride-web.vercel.app/photo.jpeg"
    },
    {
      "@type": "Organization",
      "@id": "https://indiride-web.vercel.app/#organization",
      "name": "IndiRide",
      "alternateName": ["Indi Ride", "indiride", "indi ride", "IndiRide Bihar"],
      "url": "https://indiride-web.vercel.app",
      "logo": "https://indiride-web.vercel.app/photo.jpeg",
      "image": "https://indiride-web.vercel.app/photo.jpeg",
      "foundingDate": "2024",
      "foundingLocation": {
        "@type": "Place",
        "name": "Gujarat, India"
      },
      "founder": {
        "@id": "https://indiride-web.vercel.app/#founder"
      },
      "description": "IndiRide is India's next-generation indigenous ride-hailing and campus carpooling technology platform. Founded by Shubham Kumar in Gujarat with primary operations serving Bihar and India.",
      "areaServed": [
        {
          "@type": "AdministrativeArea",
          "name": "Bihar, India"
        },
        {
          "@type": "AdministrativeArea",
          "name": "Gujarat, India"
        },
        {
          "@type": "Country",
          "name": "India"
        }
      ]
    },
    {
      "@type": "Person",
      "@id": "https://indiride-web.vercel.app/#founder",
      "name": "Shubham Kumar",
      "givenName": "Shubham",
      "familyName": "Kumar",
      "gender": "Male",
      "jobTitle": "Founder & CEO, Cloud and DevOps Engineer",
      "description": "Shubham Kumar is a 22-year-old Cloud and DevOps Engineer from Bihar, India. He is the Founder & CEO of IndiRide (Indi Ride), which was built and engineered in Gujarat to revolutionize transparent, affordable mobility for Bihar and Bharat.",
      "image": {
        "@type": "ImageObject",
        "@id": "https://indiride-web.vercel.app/#founder-image",
        "url": "https://indiride-web.vercel.app/photo.jpeg",
        "caption": "Shubham Kumar - Founder & CEO of IndiRide, 22-year-old Cloud & DevOps Engineer from Bihar, India"
      },
      "worksFor": {
        "@id": "https://indiride-web.vercel.app/#organization"
      },
      "homeLocation": {
        "@type": "Place",
        "name": "Bihar, India"
      },
      "birthPlace": {
        "@type": "Place",
        "name": "Bihar, India"
      },
      "nationality": "Indian",
      "knowsAbout": [
        "Cloud Computing",
        "DevOps Engineering",
        "System Architecture",
        "FastAPI & Microservices",
        "React Native & Web",
        "PostgreSQL & Redis",
        "Ride-Hailing Technology"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://indiride-web.vercel.app/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Who is the founder of IndiRide (Indi Ride)?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IndiRide was founded by Shubham Kumar, a 22-year-old Cloud and DevOps Engineer and Tech Entrepreneur originally from Bihar, India."
          }
        },
        {
          "@type": "Question",
          "name": "Where was IndiRide founded?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IndiRide was engineered and founded in Gujarat, India, with dedicated operations focused on affordable and transparent ride-hailing across Bihar and Bharat."
          }
        },
        {
          "@type": "Question",
          "name": "What is Shubham Kumar's profession and age?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Shubham Kumar is 22 years old. He is a Cloud and DevOps Engineer, Full-Stack Developer, and the Founder & CEO of IndiRide."
          }
        },
        {
          "@type": "Question",
          "name": "What features and services are available on the IndiRide app?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IndiRide offers mobile OTP Login, Passenger & Driver Sign Up, ₹7/km Bike Taxi, ₹10/km Auto, ₹15/km Cab, Campus Carpooling, verified driver partners, zero surge pricing, and live GPS tracking with a guaranteed 4-digit pickup safety PIN."
          }
        }
      ]
    }
  ]
};

if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Replace title
  html = html.replace(/<title>.*?<\/title>/i, `<title>IndiRide (Indi Ride) - Bihar's Smart Ride-Hailing Platform | Founder: Shubham Kumar</title>`);

  // Master Head tags
  const masterHead = `
    <!-- Primary Master SEO Meta Tags -->
    <meta name="title" content="IndiRide (Indi Ride) - Bihar's Smart Ride-Hailing Platform | Founder: Shubham Kumar" />
    <meta name="description" content="IndiRide (Indi Ride / indiride) is a fast, transparent ride-hailing platform founded by Shubham Kumar (22-year-old Cloud and DevOps Engineer from Bihar, developed in Gujarat). Features instant Login, Sign Up, Bike Taxi (₹7/km), Auto (₹10/km), Cab (₹15/km), Campus Rides & real-time GPS tracking." />
    <meta name="keywords" content="IndiRide, Indi Ride, indiride, indi ride, IndiRide login, IndiRide signup, Shubham Kumar, Shubham Kumar Bihar, Shubham Kumar founder, Shubham Kumar Cloud DevOps Engineer, 22 year old founder, IndiRide Gujarat, Bihar ride hailing, Patna cab booking, Bihar bike taxi, student carpool, campus ride" />
    <meta name="author" content="Shubham Kumar (Founder & CEO, Cloud and DevOps Engineer - Bihar, India)" />
    <meta name="publisher" content="IndiRide" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="https://indiride-web.vercel.app/" />
    <meta name="theme-color" content="#2563EB" />

    <!-- Geo & Regional Tags (Bihar & Gujarat) -->
    <meta name="geo.region" content="IN-BR, IN-GJ" />
    <meta name="geo.placename" content="Patna, Bihar / Vadodara, Gujarat, India" />
    <meta name="geo.position" content="25.5941;85.1376" />
    <meta name="ICBM" content="25.5941, 85.1376" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://indiride-web.vercel.app/" />
    <meta property="og:site_name" content="IndiRide" />
    <meta property="og:title" content="IndiRide (Indi Ride) - Bihar's Smart Ride-Hailing Platform | Founder: Shubham Kumar" />
    <meta property="og:description" content="Book transparent bike taxi (₹7/km), auto (₹10/km) & cab (₹15/km) rides in Bihar & India. Founded by Shubham Kumar (22, Cloud & DevOps Engineer from Bihar, company founded in Gujarat)." />
    <meta property="og:image" content="https://indiride-web.vercel.app/photo.jpeg" />
    <meta property="og:image:secure_url" content="https://indiride-web.vercel.app/photo.jpeg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta property="og:image:alt" content="Shubham Kumar - Founder & CEO of IndiRide, 22-year-old Cloud and DevOps Engineer from Bihar, India" />

    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://indiride-web.vercel.app/" />
    <meta name="twitter:title" content="IndiRide (Indi Ride) - Bihar's Smart Ride-Hailing | Founder: Shubham Kumar" />
    <meta name="twitter:description" content="Fast, affordable bike taxi (₹7/km), auto & cab in Bihar & India. Founded by Shubham Kumar (22, Cloud & DevOps Engineer from Bihar | Founded in Gujarat)." />
    <meta name="twitter:image" content="https://indiride-web.vercel.app/photo.jpeg" />
    <meta name="twitter:image:alt" content="Shubham Kumar - Founder of IndiRide" />

    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json" id="indiride-rich-schema">
${JSON.stringify(masterSeoSchema, null, 2)}
    </script>
`;

  // Insert master head before </head>
  html = html.replace('</head>', `${masterHead}\n</head>`);

  // Pre-rendered accessible semantic HTML for Search Engine Crawlers
  const semanticCrawlerHtml = `
    <!-- Search Engine Indexable Content (Pre-rendered for Googlebot, Bingbot, Yandex) -->
    <div id="seo-pre-rendered" style="display:none;" aria-hidden="true">
      <header>
        <h1>IndiRide (Indi Ride) - Bihar's Smart Ride-Hailing Platform</h1>
        <p>Founded by Shubham Kumar (22-year-old Cloud and DevOps Engineer from Bihar, Company Founded in Gujarat).</p>
      </header>
      <main>
        <section id="founder-profile">
          <h2>About the Founder: Shubham Kumar</h2>
          <p>Founder &amp; CEO: Shubham Kumar</p>
          <p>Age: 22 Years Old</p>
          <p>Native State: Bihar, India</p>
          <p>Profession: Cloud and DevOps Engineer &amp; Full-Stack Software Developer</p>
          <p>Company Inception: Founded &amp; Engineered in Gujarat, India</p>
          <img src="/photo.jpeg" alt="Shubham Kumar - Founder &amp; CEO of IndiRide, Cloud and DevOps Engineer from Bihar" width="400" height="400" />
        </section>
        <section id="application-features">
          <h2>IndiRide Application Features &amp; Services</h2>
          <ul>
            <li><strong>Login &amp; Sign Up:</strong> Instant mobile OTP login for Passengers and Driver Partners.</li>
            <li><strong>Bike Taxi:</strong> Transparent ₹7 per km rate with verified riders and helmets.</li>
            <li><strong>Auto Rickshaw:</strong> Fixed transparent pricing at ₹10 per km with zero surge exploitation.</li>
            <li><strong>Cab &amp; Taxi:</strong> AC Cabs at ₹15 per km across Patna, Bihar and India.</li>
            <li><strong>Campus Rides &amp; Carpooling:</strong> Safe student carpooling for universities and colleges.</li>
            <li><strong>Safety &amp; Tracking:</strong> Real-time live GPS driver tracking with guaranteed 4-digit safety pickup PIN.</li>
            <li><strong>24x7 Support:</strong> Instant assistance and emergency SOS capabilities.</li>
          </ul>
        </section>
      </main>
    </div>
  `;

  // Insert before <div id="root">
  html = html.replace('<div id="root">', `${semanticCrawlerHtml}\n    <div id="root">`);

  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  fs.writeFileSync(twoHundredPath, html, 'utf8');
  fs.writeFileSync(redirectsPath, '/*    /index.html   200\n', 'utf8');
  console.log('[fix-web-export] Successfully injected masterclass SEO tags, Schema.org graph, and semantic crawler HTML.');
}

console.log('[fix-web-export] Web build post-processing complete.');
