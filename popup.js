document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get('jwtToken', function(data) {
    if (data.jwtToken) {
      document.getElementById('token').textContent = 'Authorized!';
    } else {
      document.getElementById('token').textContent = 'No token found.';
    }
  });
});
