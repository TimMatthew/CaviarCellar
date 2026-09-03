(function () {
  "use strict";

  var INITIAL_SCROLL_OFFSET = 60;

  window.addEventListener("pageshow", function (event) {
    if (event.persisted || window.location.hash || window.scrollY > 1) return;

    window.requestAnimationFrame(function () {
      var previousScrollBehavior = document.documentElement.style.scrollBehavior;

      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, INITIAL_SCROLL_OFFSET);

      window.requestAnimationFrame(function () {
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      });
    });
  });
})();
