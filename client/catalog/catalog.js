(function () {
  "use strict";

  // Product data is provided by products.js as a global array: window.PRODUCTS
  // (loaded via <script src="products.js"> BEFORE this file). This avoids fetch(),
  // so the page also works when opened directly from disk (file://).
  var IMAGE_BASE = "../assets/catalog/cans/ready/";
  var ICON_BASE = "../assets/catalog/svg/";

  /* ---------- helpers ---------- */

  function groupDigits(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  }
  function formatUAH(n) {
    return groupDigits(n) + "\u00A0\u0433\u0440\u043D"; // "<n> грн"
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  // Fallback image filename derived from the product name, e.g.
  // "Royal Beluga Reserve" -> "royal-beluga-reserve.png".
  function slugify(name) {
    return String(name).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* ---------- rendering ---------- */

  function metaRow(icon, label, value) {
    return (
      '<div class="product-card__meta-row">' +
        '<img class="product-card__meta-icon" src="' +
          escapeHtml(ICON_BASE + icon + "-svgrepo-com.svg") +
          '" alt="' + escapeHtml(label) + '" width="18" height="18" />' +
        '<dd>' + escapeHtml(value) + '</dd>' +
      '</div>'
    );
  }

  function buildCard(p) {
    var amount = (typeof p.amount === "number") ? p.amount : 0;
    var inStock = amount > 0;

    var imageFile = p.image || (slugify(p.name) + ".png");
    var imageSrc = IMAGE_BASE + imageFile;

    var stockClass = inStock ? "product-card__stock--in" : "product-card__stock--out";
    var stockText = inStock
      ? "\u0404 \u0432 \u043D\u0430\u044F\u0432\u043D\u043E\u0441\u0442\u0456 - " + amount // Є в наявності - n
      : "\u041D\u0430\u0440\u0430\u0437\u0456 \u043D\u0435\u043C\u0430\u0454 \u0432 \u043D\u0430\u044F\u0432\u043D\u043E\u0441\u0442\u0456"; // Наразі немає в наявності

    var orderButton = inStock
      ? '<button class="product-card__order-button" type="button" aria-label="' +
          escapeHtml("\u0417\u0430\u043C\u043E\u0432\u0438\u0442\u0438 " + p.name) + '">' +
          "\u0417\u0430\u043C\u043E\u0432\u0438\u0442\u0438" + // Замовити
        '</button>'
      : "";

    var article = document.createElement("article");
    article.className = "product-card";
    article.innerHTML =
      '<div class="product-card__media">' +
        '<img class="product-card__image" src="' + escapeHtml(imageSrc) +
          '" alt="' + escapeHtml("\u0406\u043A\u0440\u0430 " + p.name) + // Ікра <name>
          '" width="640" height="480" loading="lazy" />' +
      '</div>' +
      '<div class="product-card__content">' +
        '<header class="product-card__header">' +
          '<h2 class="product-card__title">' + escapeHtml(p.name) + '</h2>' +
          '<span class="product-card__stock ' + stockClass + '">' + escapeHtml(stockText) + '</span>' +
          '<dl class="product-card__meta">' +
            metaRow("earth", "\u0412\u0438\u0440\u043E\u0431\u043D\u0438\u043A", p.manufacturer) + // Виробник
            metaRow("weight", "\u041C\u0430\u0441\u0430 \u043D\u0435\u0442\u043E", p.netWeightGrams + " \u0433") + // Маса нето / г
            metaRow("fish", "\u0420\u0438\u0431\u0430", p.fish) + // Риба
          '</dl>' +
        '</header>' +
        '<p class="product-card__description">' + escapeHtml(p.description) + '</p>' +
        '<footer class="product-card__footer">' +
          '<p class="product-card__price">' + escapeHtml(formatUAH(p.priceUah)) + '</p>' +
          orderButton +
        '</footer>' +
      '</div>';

    // Stash the data the modal needs, so we don't re-parse the DOM.
    if (inStock) {
      article._product = { amount: amount, price: p.priceUah, name: p.name };
    }
    // Data used by the filter sidebar (kept for every card, in or out of stock).
    article._filter = {
      fish: p.fish,
      country: p.manufacturer,
      weight: Number(p.netWeightGrams) || 0
    };
    return article;
  }

  function renderProducts(grid, products) {
    var frag = document.createDocumentFragment();
    products.forEach(function (p) {
      frag.appendChild(buildCard(p));
    });
    grid.innerHTML = "";        // replace any placeholder / static markup
    grid.appendChild(frag);
  }

  /* ---------- ordering modal ---------- */

  function initOrdering(grid) {
    var openState = null; // { overlay, button }

    function closeModal() {
      if (!openState) return;
      openState.button.setAttribute("aria-expanded", "false");
      openState.button.focus();
      openState.overlay.remove();
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.classList.remove("order-modal-open");
      openState = null;
    }

    function onKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }

    grid.querySelectorAll(".product-card").forEach(function (card) {
      var button = card.querySelector(".product-card__order-button");
      if (!button || !card._product) return;

      var data = card._product;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", function () {
        openModal(button, data.amount, data.price, data.name);
      });
    });

    function openModal(button, maxAmount, unitPrice, productName) {
      closeModal();
      var startQty = Math.min(1, maxAmount);

      // Full-screen backdrop: blurs and blocks all interaction with the page behind it
      var overlay = document.createElement("div");
      overlay.className = "order-overlay";

      var modal = document.createElement("div");
      modal.className = "order-popover";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "\u0417\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F" + (productName ? " " + productName : ""));

      // Close (X) button, top-right
      var close = document.createElement("button");
      close.type = "button";
      close.className = "order-popover__close";
      close.setAttribute("aria-label", "\u0417\u0430\u043A\u0440\u0438\u0442\u0438"); // Закрити
      close.innerHTML = "&times;";
      close.addEventListener("click", closeModal);

      // Product title, top-center
      var title = document.createElement("h3");
      title.className = "order-popover__title";
      title.textContent = productName;

      var total = document.createElement("p");
      total.className = "order-popover__total";
      var totalLabel = document.createElement("span");
      totalLabel.className = "order-popover__total-label";
      totalLabel.textContent = "\u0420\u0430\u0437\u043E\u043C"; // Разом
      var totalValue = document.createElement("strong");
      totalValue.className = "order-popover__total-value";
      total.appendChild(totalLabel);
      total.appendChild(totalValue);

      var range = document.createElement("input");
      range.type = "range";
      range.className = "order-popover__range";
      range.min = "0";
      range.max = String(maxAmount);
      range.step = "1";
      range.value = String(startQty);
      range.setAttribute("aria-label", "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C"); // Кількість

      var qty = document.createElement("p");
      qty.className = "order-popover__qty";

      var confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "order-popover__confirm";
      confirm.textContent = "\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F"; // Підтвердити замовлення

      function render() {
        var q = parseInt(range.value, 10) || 0;
        totalValue.textContent = formatUAH(q * unitPrice);
        qty.textContent = q + " \u043A\u043E\u0440\u043E\u0431\u043E\u043A"; // "n коробок"
        confirm.disabled = q <= 0;
      }

      range.addEventListener("input", render);

      confirm.addEventListener("click", function () {
        var q = parseInt(range.value, 10) || 0;
        if (q <= 0) return;
        modal.innerHTML = "";
        var msg = document.createElement("p");
        msg.className = "order-popover__done";
        msg.textContent = "\u0417\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043E"; // Замовлення підтверджено
        modal.appendChild(msg);
        setTimeout(closeModal, 1400);
      });

      modal.appendChild(close);
      modal.appendChild(title);
      modal.appendChild(total);
      modal.appendChild(range);
      modal.appendChild(qty);
      modal.appendChild(confirm);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.body.classList.add("order-modal-open");

      render();
      openState = { overlay: overlay, button: button };
      button.setAttribute("aria-expanded", "true");
      range.focus();

      document.addEventListener("keydown", onKeyDown, true);
    }
  }

  /* ---------- filter sidebar ---------- */

  function uniqueSorted(values) {
    return Array.from(new Set(values)).sort(function (a, b) {
      return String(a).localeCompare(String(b), "uk");
    });
  }

  function setupFilters(grid, products) {
    var toggle = document.querySelector(".catalog-filter-toggle");
    if (!toggle) return;

    var fishTypes = uniqueSorted(products.map(function (p) { return p.fish; }));
    var countries = uniqueSorted(products.map(function (p) { return p.manufacturer; }));
    var weights = products
      .map(function (p) { return Number(p.netWeightGrams) || 0; })
      .filter(function (w) { return w > 0; });
    var minWeight = weights.length ? Math.min.apply(null, weights) : 0;
    var maxWeight = weights.length ? Math.max.apply(null, weights) : 0;

    // Selected state
    var selectedFish = new Set();
    var selectedCountries = new Set();
    var massMin = minWeight;
    var massMax = maxWeight;

    /* ---- build DOM ---- */

    var backdrop = document.createElement("div");
    backdrop.className = "filter-backdrop";

    var sidebar = document.createElement("aside");
    sidebar.className = "filter-sidebar";
    sidebar.id = "filter-sidebar";
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.setAttribute("aria-label", "\u0424\u0456\u043B\u044C\u0442\u0440\u0438"); // Фільтри

    // header
    var header = document.createElement("div");
    header.className = "filter-sidebar__header";
    var hTitle = document.createElement("h2");
    hTitle.className = "filter-sidebar__title";
    hTitle.textContent = "\u0424\u0456\u043B\u044C\u0442\u0440\u0438"; // Фільтри
    var hClose = document.createElement("button");
    hClose.type = "button";
    hClose.className = "filter-sidebar__close";
    hClose.setAttribute("aria-label", "\u0417\u0430\u043A\u0440\u0438\u0442\u0438"); // Закрити
    hClose.innerHTML = "&times;";
    header.appendChild(hTitle);
    header.appendChild(hClose);
    sidebar.appendChild(header);

    // checkbox group builder
    function buildCheckboxGroup(titleText, values, selectedSet) {
      var group = document.createElement("div");
      group.className = "filter-group";
      var t = document.createElement("h3");
      t.className = "filter-group__title";
      t.textContent = titleText;
      group.appendChild(t);

      values.forEach(function (value) {
        var label = document.createElement("label");
        label.className = "filter-option";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = value;
        cb.addEventListener("change", function () {
          if (cb.checked) selectedSet.add(value);
          else selectedSet.delete(value);
          applyFilters();
        });
        var span = document.createElement("span");
        span.textContent = value;
        label.appendChild(cb);
        label.appendChild(span);
        group.appendChild(label);
      });
      return group;
    }

    sidebar.appendChild(
      buildCheckboxGroup("\u0420\u0438\u0431\u0430", fishTypes, selectedFish) // Риба
    );
    sidebar.appendChild(
      buildCheckboxGroup("\u041A\u0440\u0430\u0457\u043D\u0430", countries, selectedCountries) // Країна
    );

    // ---- mass dual-range group ----
    var massGroup = document.createElement("div");
    massGroup.className = "filter-group";
    var massTitle = document.createElement("h3");
    massTitle.className = "filter-group__title";
    massTitle.textContent = "\u041C\u0430\u0441\u0430, \u0433"; // Маса, г
    massGroup.appendChild(massTitle);

    var rangeWrap = document.createElement("div");
    rangeWrap.className = "filter-range";

    var values = document.createElement("p");
    values.className = "filter-range__values";

    var track = document.createElement("div");
    track.className = "filter-range__track";
    var fill = document.createElement("div");
    fill.className = "filter-range__fill";

    var step = 10;
    var minInput = document.createElement("input");
    minInput.type = "range";
    minInput.className = "filter-range__input filter-range__input--min";
    minInput.min = String(minWeight);
    minInput.max = String(maxWeight);
    minInput.step = String(step);
    minInput.value = String(minWeight);
    minInput.setAttribute("aria-label", "\u041C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0430 \u043C\u0430\u0441\u0430"); // Мінімальна маса

    var maxInput = document.createElement("input");
    maxInput.type = "range";
    maxInput.className = "filter-range__input filter-range__input--max";
    maxInput.min = String(minWeight);
    maxInput.max = String(maxWeight);
    maxInput.step = String(step);
    maxInput.value = String(maxWeight);
    maxInput.setAttribute("aria-label", "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430 \u043C\u0430\u0441\u0430"); // Максимальна маса

    track.appendChild(fill);
    track.appendChild(minInput);
    track.appendChild(maxInput);
    rangeWrap.appendChild(values);
    rangeWrap.appendChild(track);
    massGroup.appendChild(rangeWrap);
    sidebar.appendChild(massGroup);

    function pct(v) {
      if (maxWeight === minWeight) return 0;
      return ((v - minWeight) / (maxWeight - minWeight)) * 100;
    }
    function updateRangeUI() {
      values.innerHTML =
        "<strong>" + massMin + "</strong> \u2013 <strong>" + massMax + "</strong> \u0433"; // n – m г
      rangeWrap.style.setProperty("--min-pct", pct(massMin) + "%");
      rangeWrap.style.setProperty("--max-pct", pct(massMax) + "%");
    }

    minInput.addEventListener("input", function () {
      var a = Number(minInput.value);
      if (a > massMax) { a = massMax; minInput.value = String(a); }
      massMin = a;
      updateRangeUI();
      applyFilters();
    });
    maxInput.addEventListener("input", function () {
      var b = Number(maxInput.value);
      if (b < massMin) { b = massMin; maxInput.value = String(b); }
      massMax = b;
      updateRangeUI();
      applyFilters();
    });

    // footer / reset
    var footer = document.createElement("div");
    footer.className = "filter-sidebar__footer";
    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "filter-reset";
    reset.textContent = "\u0421\u043A\u0438\u043D\u0443\u0442\u0438 \u0444\u0456\u043B\u044C\u0442\u0440\u0438"; // Скинути фільтри
    footer.appendChild(reset);
    sidebar.appendChild(footer);

    reset.addEventListener("click", function () {
      selectedFish.clear();
      selectedCountries.clear();
      sidebar.querySelectorAll('.filter-option input[type="checkbox"]').forEach(function (cb) {
        cb.checked = false;
      });
      massMin = minWeight;
      massMax = maxWeight;
      minInput.value = String(minWeight);
      maxInput.value = String(maxWeight);
      updateRangeUI();
      applyFilters();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(sidebar);

    /* ---- open / close ---- */

    function openSidebar() {
      backdrop.classList.add("is-open");
      sidebar.classList.add("is-open");
      sidebar.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", onEsc, true);
    }
    function closeSidebar() {
      backdrop.classList.remove("is-open");
      sidebar.classList.remove("is-open");
      sidebar.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onEsc, true);
    }
    function onEsc(e) {
      if (e.key === "Escape") closeSidebar();
    }

    toggle.addEventListener("click", function () {
      if (sidebar.classList.contains("is-open")) closeSidebar();
      else openSidebar();
    });
    hClose.addEventListener("click", closeSidebar);

    /* ---- filtering ---- */

    var emptyMsg = null;
    function applyFilters() {
      var cards = grid.querySelectorAll(".product-card");
      var visible = 0;
      cards.forEach(function (card) {
        var f = card._filter;
        if (!f) return;
        var okFish = selectedFish.size === 0 || selectedFish.has(f.fish);
        var okCountry = selectedCountries.size === 0 || selectedCountries.has(f.country);
        var okMass = f.weight >= massMin && f.weight <= massMax;
        var show = okFish && okCountry && okMass;
        card.hidden = !show;
        if (show) visible++;
      });

      if (visible === 0) {
        if (!emptyMsg) {
          emptyMsg = document.createElement("p");
          emptyMsg.className = "products-grid__empty";
          emptyMsg.textContent = "\u041D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E"; // Нічого не знайдено
        }
        if (!emptyMsg.isConnected) grid.appendChild(emptyMsg);
      } else if (emptyMsg && emptyMsg.isConnected) {
        emptyMsg.remove();
      }
    }

    updateRangeUI();
  }

  /* ---------- bootstrap ---------- */

  function showError(grid) {
    grid.innerHTML =
      '<p class="products-grid__error">' +
      "\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u043F\u0440\u043E\u0434\u0443\u043A\u0446\u0456\u044E." + // Не вдалося завантажити продукцію.
      '</p>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.querySelector(".products-grid");
    if (!grid) return;

    var products = window.PRODUCTS;
    if (!Array.isArray(products)) {
      showError(grid);
      console.error(
        "window.PRODUCTS is not available. Make sure products.js is loaded " +
        "with <script src=\"products.js\"></script> BEFORE catalog.js."
      );
      return;
    }

    renderProducts(grid, products);
    initOrdering(grid);
    setupFilters(grid, products);
  });
})();