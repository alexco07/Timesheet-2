// === CONFIGURATION ===
const GAS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

google.charts.load('current', {'packages':['corechart', 'bar']});
google.charts.setOnLoadCallback(fetchDashboardData);

async function fetchDashboardData() {
  document.getElementById('val-working').innerText = '...';
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getDashboardData' })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      updateWidgets(result.data);
      updateTable(result.data.recentActivity);
      drawChart(result.data.weeklyHoursData);
    } else {
      console.error("Backend Error:", result.message);
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }
}

function updateWidgets(data) {
  document.getElementById('val-working').innerText = data.currentlyWorking;
  document.getElementById('val-missing').innerText = data.missingClockOuts;
  document.getElementById('val-overtime').innerText = data.overtimeToday;
  document.getElementById('val-total').innerText = data.totalEmployees; 
}

function updateTable(logs) {
  const tbody = document.getElementById('activity-table');
  tbody.innerHTML = '';
  
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">No activity today</td></tr>';
    return;
  }
  
  logs.forEach(log => {
    let badgeClass = 'bg-yellow';
    if (log.action === 'Clock In') badgeClass = 'bg-green';
    if (log.action === 'Clock Out') badgeClass = 'bg-red';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${log.empId}</strong></td>
      <td><span class="badge ${badgeClass}">${log.action}</span></td>
      <td>${log.time}</td>
    `;
    tbody.appendChild(tr);
  });
}

function drawChart(chartData) {
  const data = google.visualization.arrayToDataTable(chartData);
  
  const options = {
    colors: ['#1976D2'],
    legend: { position: 'none' },
    vAxis: { minValue: 0 },
    animation: { startup: true, duration: 1000, easing: 'out' }
  };
  
  const chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
  chart.draw(data, options);
}
