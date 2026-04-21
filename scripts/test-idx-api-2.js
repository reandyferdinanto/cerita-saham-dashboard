async function testIDXApi() {
  const url = "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles?start=0&length=10";
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan/" 
  };

  console.log("Fetching from IDX with full headers...");
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
        const data = await res.json();
        console.log("Success! Found:", data.recordsTotal, "companies.");
    } else {
        console.log("Failed. Status:", res.status);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testIDXApi();
