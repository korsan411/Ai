// ================= Tabs behavior =================
function initTabs() {
  try {
    document.querySelectorAll('.tab-buttons button').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          document.querySelectorAll('.tab-buttons button').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
          
          btn.classList.add('active');
          const tabId = btn.dataset.tab;
          const tabContent = document.getElementById(tabId);
          
          if (tabContent) {
            tabContent.classList.add('active');
          }

          if (tabId === 'simulation' && document.getElementById('gcodeOut').value) {
            initSimulation();
          }
        } catch (error) {
          console.error('فشل في تبديل التبويبات:', error);
        }
      });
    });
  } catch (error) {
    console.error('فشل في تهيئة التبويبات:', error);
  }
}