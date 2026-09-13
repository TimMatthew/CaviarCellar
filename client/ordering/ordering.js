(function () {
  "use strict";

  // Frontend-only sample data. Nova Poshta/Nova Post lookups will replace this
  // object when the ordering page is connected to the backend.
  var destinations = {
    UA: {
      cities: [
        {
          value: "kyiv",
          label: "Київ",
          warehouses: [
            { value: "ua-kyiv-1", label: "Відділення №1 — вул. Пирогівський шлях, 135" },
            { value: "ua-kyiv-7", label: "Відділення №7 — вул. Гната Хоткевича, 8" }
          ]
        },
        {
          value: "lviv",
          label: "Львів",
          warehouses: [
            { value: "ua-lviv-1", label: "Відділення №1 — вул. Городоцька, 359" }
          ]
        },
        {
          value: "odesa",
          label: "Одеса",
          warehouses: [
            { value: "ua-odesa-3", label: "Відділення №3 — вул. Дальницька, 23/4" }
          ]
        }
      ]
    },
    PL: {
      cities: [
        {
          value: "warsaw",
          label: "Варшава",
          warehouses: [
            { value: "pl-warsaw-1", label: "Nova Post — Męcińska 18" }
          ]
        },
        {
          value: "krakow",
          label: "Краків",
          warehouses: [
            { value: "pl-krakow-1", label: "Nova Post — Kamienna 19B" }
          ]
        }
      ]
    },
    DE: {
      cities: [
        {
          value: "berlin",
          label: "Берлін",
          warehouses: [
            { value: "de-berlin-1", label: "Nova Post — Charlottenstraße 79/80" }
          ]
        },
        {
          value: "munich",
          label: "Мюнхен",
          warehouses: [
            { value: "de-munich-1", label: "Nova Post — Arnulfstraße 197" }
          ]
        }
      ]
    }
  };

  function appendPlaceholder(select, text) {
    var option = document.createElement("option");
    option.value = "";
    option.textContent = text;
    option.selected = true;
    option.disabled = true;
    select.appendChild(option);
  }

  function appendOption(parent, item) {
    var option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    parent.appendChild(option);
  }

  function formatUah(value) {
    return new Intl.NumberFormat("uk-UA").format(Number(value) || 0) + "\u00A0грн";
  }

  function renderOrderSummary(products) {
    var tbody = document.querySelector("[data-order-summary-items]");
    var totalOutput = document.querySelector("[data-order-total]");
    if (!tbody || !totalOutput || !window.CaviarBasket) return;

    var items = window.CaviarBasket.getItems();
    tbody.innerHTML = "";

    if (items.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.className = "order-summary__state";
      emptyCell.colSpan = 3;
      emptyCell.textContent = "У кошику поки немає товарів";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      totalOutput.textContent = formatUah(0);
      return;
    }

    var orderTotal = 0;
    items.forEach(function (item) {
      var product = products.get(Number(item.caviarId));
      var quantity = Math.max(0, Number(item.quantity) || 0);
      var unitPrice = product ? Number(product.priceUah) || 0 : 0;
      var lineTotal = unitPrice * quantity;
      orderTotal += lineTotal;

      var row = document.createElement("tr");
      var titleCell = document.createElement("td");
      var totalCell = document.createElement("td");
      var quantityCell = document.createElement("td");

      titleCell.className = "order-summary__product-title";
      titleCell.textContent = product ? product.title : "Товар №" + item.caviarId;
      totalCell.className = "order-summary__line-total";
      totalCell.textContent = product ? formatUah(lineTotal) : "—";
      quantityCell.className = "order-summary__quantity";
      quantityCell.textContent = String(quantity);

      row.appendChild(titleCell);
      row.appendChild(totalCell);
      row.appendChild(quantityCell);
      tbody.appendChild(row);
    });

    totalOutput.textContent = formatUah(orderTotal);
  }

  function initOrderSummary() {
    var tbody = document.querySelector("[data-order-summary-items]");
    var basketButton = document.querySelector("[data-open-basket]");
    if (!tbody || !window.CaviarBasket) return;

    var products = new Map();

    if (basketButton) {
      basketButton.addEventListener("click", function () {
        window.CaviarBasket.open();
      });
    }

    function rerender() {
      renderOrderSummary(products);
    }

    window.addEventListener("caviar:basket-change", rerender);
    window.addEventListener("storage", function (event) {
      if (event.key === "caviar-cellar:basket:v1") rerender();
    });

    window.CaviarBasket.refresh()
      .then(function (productMap) {
        products = productMap;
        rerender();
      })
      .catch(function () {
        tbody.innerHTML = "";
        var row = document.createElement("tr");
        var cell = document.createElement("td");
        cell.className = "order-summary__state";
        cell.colSpan = 3;
        cell.textContent = "Не вдалося завантажити товари";
        row.appendChild(cell);
        tbody.appendChild(row);
      });
  }

  function initPhoneInput() {
  var codeSelect = document.querySelector("#customer-phone-code");
  var phoneNumber = document.querySelector("#customer-phone");

  if (!codeSelect || !phoneNumber || typeof DIAL_CODES === "undefined") return;

    function nsnRange(country) {
      var length = country.nsn;
      return Array.isArray(length)
        ? { min: length[0], max: length[1] }
        : { min: length, max: length };
    }

    function currentCountry() {
      return DIAL_CODES[Number(codeSelect.value) || 0];
    }

    function phoneDigits(value) {
      return String(value || "").replace(/\D/g, "");
    }

    function groupDigits(digits) {
      return digits.replace(/(.{3})/g, "$1 ").trim();
    }

    function updatePhoneMeta() {
      var country = currentCountry();
      var range = nsnRange(country);

    phoneNumber.placeholder = groupDigits("X".repeat(range.min));
    phoneNumber.maxLength = range.max + Math.floor((range.max - 1) / 3);

    if (phoneNumber.value) {
        phoneNumber.value = groupDigits(phoneDigits(phoneNumber.value).slice(0, range.max));
      }
    }

    DIAL_CODES.forEach(function (country, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = country.flag + " " + country.code;
      option.title = country.name;
      option.setAttribute("aria-label", country.name + " " + country.code);
      if (index === 0) option.selected = true;
      codeSelect.appendChild(option);
    });

    phoneNumber.addEventListener("input", function () {
      var country = currentCountry();
      var range = nsnRange(country);
      var raw = phoneNumber.value;
      var digits = phoneDigits(raw);
      var codeDigits = country.code.replace(/\D/g, "");
      var pastedFull = /^\s*\+/.test(raw) || digits.indexOf("00" + codeDigits) === 0;

      if (pastedFull) {
        if (digits.indexOf("00" + codeDigits) === 0) {
          digits = digits.slice(2 + codeDigits.length);
        } else if (digits.indexOf(codeDigits) === 0) {
          digits = digits.slice(codeDigits.length);
        }
      }

      if (digits.length > range.max && digits.charAt(0) === "0") {
        digits = digits.slice(1);
      }

      phoneNumber.value = groupDigits(digits.slice(0, range.max));
    });

    codeSelect.addEventListener("change", updatePhoneMeta);
    updatePhoneMeta();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initOrderSummary();
    initPhoneInput();

    var countrySelect = document.querySelector("#delivery-country");
    var citySelect = document.querySelector("#delivery-city");
    var warehouseSelect = document.querySelector("#delivery-warehouse");
    var warehouseField = document.querySelector("#warehouse-field");

    if (!countrySelect || !citySelect || !warehouseSelect || !warehouseField) return;

    function selectedDestination() {
      return destinations[countrySelect.value] || null;
    }

    function updateCities() {
      var destination = selectedDestination();
      citySelect.innerHTML = "";

      if (!destination) {
        appendPlaceholder(citySelect, "Спочатку оберіть країну");
        citySelect.disabled = true;
        return;
      }

      appendPlaceholder(citySelect, "Оберіть місто");
      destination.cities.forEach(function (city) {
        appendOption(citySelect, city);
      });
      citySelect.disabled = false;
    }

    function updateWarehouses() {
      var destination = selectedDestination();
      var selectedCity = citySelect.value;
      warehouseSelect.innerHTML = "";

      if (!destination) {
        appendPlaceholder(warehouseSelect, "Спочатку оберіть країну");
        warehouseSelect.disabled = true;
        warehouseField.hidden = true;
        return;
      }

      appendPlaceholder(
        warehouseSelect,
        selectedCity ? "Оберіть відділення" : "Оберіть місто або відділення"
      );

      destination.cities
        .filter(function (city) {
          return !selectedCity || city.value === selectedCity;
        })
        .forEach(function (city) {
          var group = document.createElement("optgroup");
          group.label = city.label;
          city.warehouses.forEach(function (warehouse) {
            appendOption(group, warehouse);
          });
          warehouseSelect.appendChild(group);
        });

      warehouseSelect.disabled = false;
      warehouseField.hidden = false;
    }

    countrySelect.addEventListener("change", function () {
      updateCities();
      updateWarehouses();
    });

    citySelect.addEventListener("change", updateWarehouses);

    updateCities();
    updateWarehouses();
  });
})();
