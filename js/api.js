// REPLACE THIS URL AFTER DEPLOYING YOUR GOOGLE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbx9YROunILxu-W86wV4wPd6RizlejmwlfckCntsPTeSbOvCSpL4QwnOkt9vZ_QHLb6Gjg/exec";

async function callAPI(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, payload: payload })
    });
    return await response.json();
  } catch (error) {
    console.error("API Call Error:", error);
    return { status: "error", message: error.message };
  }
}
