(function () {
  "use strict";

  var STORAGE_KEY = "caviar-cellar:basket:v1";
  var CATALOG_URL = "/api/caviar";
  var IMAGE_BASE = "/assets/catalog/cans/ready/";

  var state = {
    items: readItems(),
    products: new Map(),
    loading: true,
    error: null,
    loadedAt: 0,
    open: false
  };
  var refs = {};
  var productsRequest = null;
  var restoreFocus = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatUah(value) {
    return new Intl.NumberFormat("uk-UA").format(Number(value) || 0) + "\u00A0грн";
  }

  function normalizeItems(value) {
    if (!Array.isArray(value)) return [];
    var merged = new Map();
    value.forEach(function (item) {
      var id = Number(item && item.caviarId);
      var quantity = Math.floor(Number(item && item.quantity));
      if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        return;
      }
      merged.set(id, Math.min(999, (merged.get(id) || 0) + quantity));
    });
    return Array.from(merged, function (entry) {
      return { caviarId: entry[0], quantity: entry[1] };
    });
  }

  function readItems(rawValue) {
    try {
      var raw = rawValue === undefined ? window.localStorage.getItem(STORAGE_KEY) : rawValue;
      return normalizeItems(raw ? JSON.parse(raw) : []);
    } catch (error) {
      console.warn("Basket storage is unavailable", error);
      return [];
    }
  }

  function saveItems() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch (error) {
      console.warn("Basket could not be persisted", error);
    }
    window.dispatchEvent(
      new CustomEvent("caviar:basket-change", {
        detail: { items: getItems(), count: itemCount() }
      })
    );
  }

  function itemCount() {
    return state.items.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function getItems() {
    return state.items.map(function (item) {
      return { caviarId: item.caviarId, quantity: item.quantity };
    });
  }

  function getQuantity(caviarId) {
    var id = Number(caviarId);
    var item = state.items.find(function (entry) { return entry.caviarId === id; });
    return item ? item.quantity : 0;
  }

  function productImage(path) {
    if (!path) return "";
    var value = String(path).replace(/\\/g, "/");
    if (/^(?:https?:|data:|\/)/i.test(value)) return value;
    if (value.indexOf("/") !== -1) return "/" + value.replace(/^\.\//, "");
    return IMAGE_BASE + encodeURIComponent(value);
  }

  function announce(message) {
    if (refs.live) refs.live.textContent = message;
  }

  function updateBadge() {
    if (!refs.badge) return;
    var count = itemCount();
    refs.badge.textContent = count > 99 ? "99+" : String(count);
    refs.badge.hidden = count === 0;
    refs.toggle.setAttribute(
      "aria-label",
      count ? "Кошик, товарів: " + count : "Кошик порожній"
    );
  }

  function setCheckoutEnabled(enabled) {
    if (!refs.checkout) return;
    refs.checkout.classList.toggle("is-disabled", !enabled);
    refs.checkout.setAttribute("aria-disabled", enabled ? "false" : "true");
    refs.checkout.tabIndex = enabled ? 0 : -1;
  }

  function render() {
    if (!refs.items) return;
    updateBadge();

    if (state.loading && state.products.size === 0) {
      refs.items.innerHTML = '<p class="basket-panel__state">Завантажуємо кошик…</p>';
      refs.total.textContent = formatUah(0);
      refs.clear.disabled = true;
      setCheckoutEnabled(false);
      return;
    }

    if (state.error && state.products.size === 0) {
      refs.items.innerHTML =
        '<div class="basket-panel__state basket-panel__state--error">' +
          '<p>Не вдалося завантажити актуальні товари.</p>' +
          '<button type="button" class="basket-panel__retry" data-basket-action="refresh">' +
            'Спробувати знову' +
          '</button>' +
        '</div>';
      refs.total.textContent = formatUah(0);
      refs.clear.disabled = state.items.length === 0;
      setCheckoutEnabled(false);
      return;
    }

    if (state.items.length === 0) {
      refs.items.innerHTML =
        '<div class="basket-panel__empty">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7" />' +
            '<circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />' +
          '</svg>' +
          '<p>Ваш кошик порожній</p>' +
          '<a href="/catalog/catalog.html" data-basket-action="close">Перейти до каталогу</a>' +
        '</div>';
      refs.total.textContent = formatUah(0);
      refs.clear.disabled = true;
      setCheckoutEnabled(false);
      return;
    }

    var total = 0;
    refs.items.innerHTML = state.items.map(function (item) {
      var product = state.products.get(item.caviarId);
      if (!product) {
        return (
          '<article class="basket-item basket-item--unavailable" data-caviar-id="' + item.caviarId + '">' +
            '<div class="basket-item__content">' +
              '<h3>Товар більше недоступний</h3>' +
              '<p>Код товару: ' + item.caviarId + '</p>' +
              '<button type="button" class="basket-item__remove" data-basket-action="remove">Видалити</button>' +
            '</div>' +
          '</article>'
        );
      }

      var stock = Math.max(0, Number(product.amount) || 0);
      var price = Number(product.priceUah) || 0;
      total += price * item.quantity;
      var image = productImage(product.imagePath);
      var warning = stock === 0
        ? "Немає в наявності"
        : item.quantity > stock
          ? "Доступно лише: " + stock
          : "";

      return (
        '<article class="basket-item' + (warning ? ' basket-item--unavailable' : '') + '" data-caviar-id="' + item.caviarId + '">' +
          (image
            ? '<img class="basket-item__image" src="' + escapeHtml(image) + '" alt="" width="84" height="84" />'
            : '<div class="basket-item__image basket-item__image--empty" aria-hidden="true"></div>') +
          '<div class="basket-item__content">' +
            '<h3>' + escapeHtml(product.title) + '</h3>' +
            '<p class="basket-item__meta">' + escapeHtml(product.netWeightGrams + " г") + '</p>' +
            '<p class="basket-item__price">' + escapeHtml(formatUah(price)) + '</p>' +
            (warning ? '<p class="basket-item__warning">' + escapeHtml(warning) + '</p>' : '') +
            '<div class="basket-item__actions">' +
              '<div class="basket-quantity" aria-label="Кількість">' +
                '<button type="button" data-basket-action="decrease" aria-label="Зменшити кількість"' +
                  (item.quantity <= 1 || stock === 0 ? ' disabled' : '') + '>−</button>' +
                '<output aria-label="Поточна кількість">' + item.quantity + '</output>' +
                '<button type="button" data-basket-action="increase" aria-label="Збільшити кількість"' +
                  (stock === 0 || item.quantity >= stock ? ' disabled' : '') + '>+</button>' +
              '</div>' +
              '<button type="button" class="basket-item__remove" data-basket-action="remove">Видалити</button>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");

    refs.total.textContent = formatUah(total);
    refs.clear.disabled = false;
    setCheckoutEnabled(true);
  }

  function commit(items, message) {
    state.items = normalizeItems(items);
    saveItems();
    render();
    if (message) announce(message);
  }

  function setQuantity(caviarId, quantity) {
    var id = Number(caviarId);
    var product = state.products.get(id);
    var nextQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      remove(caviarId);
      return;
    }
    if (product) nextQuantity = Math.min(nextQuantity, Math.max(0, Number(product.amount) || 0));
    if (nextQuantity <= 0) return;
    commit(
      state.items.map(function (item) {
        return item.caviarId === id ? { caviarId: id, quantity: nextQuantity } : item;
      }),
      "Кількість товару оновлено"
    );
  }

  function remove(caviarId) {
    var id = Number(caviarId);
    var product = state.products.get(id);
    commit(
      state.items.filter(function (item) { return item.caviarId !== id; }),
      product ? product.title + " видалено з кошика" : "Товар видалено з кошика"
    );
  }

  async function add(caviarId, quantity) {
    await ensureProducts();
    var id = Number(caviarId);
    var requested = Math.floor(Number(quantity));
    var product = state.products.get(id);
    if (!product) throw new Error("Цей товар більше не існує");
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new Error("Оберіть кількість товару");
    }
    var stock = Math.max(0, Number(product.amount) || 0);
    if (stock === 0) throw new Error("Цього товару зараз немає в наявності");

    var current = getQuantity(id);
    var next = Math.min(stock, current + requested);
    if (next === current) throw new Error("У кошику вже вся доступна кількість цього товару");
    var items = state.items.filter(function (item) { return item.caviarId !== id; });
    items.push({ caviarId: id, quantity: next });
    commit(items, product.title + " додано до кошика");
    return { caviarId: id, quantity: next, added: next - current, limited: next < current + requested };
  }

  async function ensureProducts(force) {
    if (!force && state.products.size > 0) return state.products;
    if (productsRequest) return productsRequest;

    state.loading = true;
    state.error = null;
    render();
    productsRequest = fetch(CATALOG_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Catalog request failed with status " + response.status);
        return response.json();
      })
      .then(function (products) {
        if (!Array.isArray(products)) throw new Error("Catalog response is invalid");
        state.products = new Map(products.map(function (product) {
          return [Number(product.id), product];
        }));
        state.loadedAt = Date.now();
        state.error = null;
        return state.products;
      })
      .catch(function (error) {
        state.error = error;
        console.error("Basket catalog refresh failed", error);
        throw error;
      })
      .finally(function () {
        state.loading = false;
        productsRequest = null;
        render();
      });
    return productsRequest;
  }

  function focusableElements() {
    return Array.from(
      refs.panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function onKeyDown(event) {
    if (!state.open) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    var focusable = focusableElements();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (state.open) return;
    state.open = true;
    restoreFocus = document.activeElement;
    refs.backdrop.classList.add("is-open");
    refs.panel.classList.add("is-open");
    refs.panel.removeAttribute("inert");
    refs.panel.setAttribute("aria-hidden", "false");
    refs.toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("basket-is-open");
    document.addEventListener("keydown", onKeyDown, true);
    refs.close.focus();
    if (Date.now() - state.loadedAt > 60_000) ensureProducts(true).catch(function () {});
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    refs.backdrop.classList.remove("is-open");
    refs.panel.classList.remove("is-open");
    refs.toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("basket-is-open");
    document.removeEventListener("keydown", onKeyDown, true);
    if (restoreFocus && typeof restoreFocus.focus === "function") restoreFocus.focus();
    refs.panel.setAttribute("aria-hidden", "true");
    refs.panel.setAttribute("inert", "");
  }

  function handleAction(event) {
    var control = event.target.closest("[data-basket-action]");
    if (!control) return;
    var action = control.dataset.basketAction;
    var item = control.closest("[data-caviar-id]");
    var id = item ? Number(item.dataset.caviarId) : null;

    if (action === "close") close();
    else if (action === "checkout" && control.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      announce("Додайте товар до кошика перед оформленням");
    }
    else if (action === "remove") remove(id);
    else if (action === "decrease") setQuantity(id, getQuantity(id) - 1);
    else if (action === "increase") setQuantity(id, getQuantity(id) + 1);
    else if (action === "clear") commit([], "Кошик очищено");
    else if (action === "refresh") ensureProducts(true).catch(function () {});
  }

  function createUi() {
    var header = document.querySelector(".header-inner");
    if (!header) return false;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "basket-toggle";
    toggle.setAttribute("aria-controls", "basket-panel");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7" />' +
        '<circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />' +
      '</svg>' +
      '<span class="basket-toggle__count" hidden>0</span>';
    header.appendChild(toggle);

    var backdrop = document.createElement("div");
    backdrop.className = "basket-backdrop";
    backdrop.setAttribute("aria-hidden", "true");

    var panel = document.createElement("aside");
    panel.className = "basket-panel";
    panel.id = "basket-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "basket-panel-title");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("inert", "");
    panel.innerHTML =
      '<header class="basket-panel__header">' +
        '<div><p>Ваше замовлення</p><h2 id="basket-panel-title">Кошик</h2></div>' +
        '<button type="button" class="basket-panel__close" data-basket-action="close" aria-label="Закрити кошик">×</button>' +
      '</header>' +
      '<div class="basket-panel__items"></div>' +
      '<footer class="basket-panel__footer">' +
        '<div class="basket-panel__total"><span>Разом</span><strong>0 грн</strong></div>' +
        '<p>Остаточна ціна та наявність перевіряються під час оформлення замовлення.</p>' +
        '<div class="basket-panel__actions">' +
          '<a class="basket-panel__checkout is-disabled" href="/ordering/ordering.html" data-basket-action="checkout" aria-disabled="true" tabindex="-1">До оформлення</a>' +
          '<button type="button" class="basket-panel__clear" data-basket-action="clear">Очистити кошик</button>' +
        '</div>' +
      '</footer>' +
      '<p class="basket-panel__live" role="status" aria-live="polite"></p>';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    refs.toggle = toggle;
    refs.badge = toggle.querySelector(".basket-toggle__count");
    refs.backdrop = backdrop;
    refs.panel = panel;
    refs.close = panel.querySelector(".basket-panel__close");
    refs.items = panel.querySelector(".basket-panel__items");
    refs.total = panel.querySelector(".basket-panel__total strong");
    refs.checkout = panel.querySelector(".basket-panel__checkout");
    refs.clear = panel.querySelector(".basket-panel__clear");
    refs.live = panel.querySelector(".basket-panel__live");

    toggle.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    panel.addEventListener("click", handleAction);
    return true;
  }

  function init() {
    if (!createUi()) return;
    updateBadge();
    render();
    ensureProducts().catch(function () {});
    window.addEventListener("storage", function (event) {
      if (event.key !== STORAGE_KEY) return;
      state.items = readItems(event.newValue);
      render();
      announce("Кошик синхронізовано");
    });
  }

  window.CaviarBasket = Object.freeze({
    add: add,
    open: open,
    close: close,
    clear: function () { commit([], "Кошик очищено"); },
    remove: remove,
    getItems: getItems,
    getQuantity: getQuantity,
    refresh: function () { return ensureProducts(true); }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
