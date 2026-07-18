async function loadDashboard() {
  const res = await callAPI('getDashboardData');
  if (res.status === 'success') {
    document.getElementById('total-emp').innerText = res.data.totalEmployees;
    document.getElementById('logs-today').innerText = res.data.totalLogsToday;
  } else {
    console.error("Failed to load dashboard data");
  }
}

window.onload = loadDashboard;
