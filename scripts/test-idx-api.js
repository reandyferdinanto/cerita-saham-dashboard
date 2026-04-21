async function testIDXApi() {
  const url = "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles?start=0&length=10";
  const headers = {
    "accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan/" 
  };

  console.log("Fetching from IDX...");
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
        const data = await res.json();
        console.log("Success! Found:", data.recordsTotal, "companies.");
        console.log("Sample:", JSON.stringify(data.data[0], null, 2));
    } else {
        console.log("Failed. Status:", res.status);
        const text = await res.text();
        console.log("Response:", text.substring(0, 500));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testIDXApi();
