(function () {
  function findApi(win) {
    var currentWindow = win;
    for (var attempts = 0; attempts < 10; attempts += 1) {
      if (currentWindow.API) return currentWindow.API;
      if (!currentWindow.parent || currentWindow.parent === currentWindow) break;
      currentWindow = currentWindow.parent;
    }
    return null;
  }

  window.MentingoScormTest = {
    boot: function (label) {
      var api = findApi(window);
      if (!api) {
        document.body.setAttribute("data-api-found", "false");
        return;
      }

      document.body.setAttribute("data-api-found", "true");
      api.LMSInitialize("");
      document.getElementById("entry").textContent = api.LMSGetValue("cmi.core.entry");

      document.getElementById("finish-lesson").addEventListener("click", function () {
        api.LMSSetValue("cmi.core.lesson_status", "completed");
        api.LMSSetValue("cmi.core.lesson_location", label + "-done");
        api.LMSSetValue("cmi.core.session_time", "00:00:04");
        api.LMSFinish("");
      });
    },
  };
})();
