async function loadLogs() {
  const tbody = document.getElementById('logs-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading logs...</td></tr>';
  
  const res = await callAPI('getLogs');
  if (res.status === 'success') {
    tbody.innerHTML = '';
    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No logs found.</td></tr>';
      return;
    }
    
    res.data.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${log.logId}</td>
        <td>${log.employeeId}</td>
        <td>${log.name}</td>
        <td><strong>${log.action}</strong></td>
        <td>${log.date}</td>
        <td>${log.time}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error: ${res.message}</td></tr>`;
  }
}

window.onload = loadLogs;
