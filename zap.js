"use strict";

// Comentar a importação do Firebase se o arquivo não existir
// import { enviarPedidoParaFirebase } from "./firebase.js";

// --- Variáveis Globais ---
let cardapioData = {};
let cart = [];
let currentCategory = "Promoções";
let currentItem = null;
let pendingMilkShake = null;
let modeEntrega = "";
let taxaEntregaAtual = 0;
let autocomplete; // Variável para o Google Autocomplete

// Configuração da Origem: Rua Lauro de Souza, 465
const ORIGEM_COORD = { lat: -8.02465, lon: -34.87567 };

// Customização de Combo
let comboCustomization = {
  item: null,
  currentBurgerIndex: -1,
  totalCustomizations: [],
  basePrice: 0,
  optionName: "",
  paidExtras: [],
};

const whatsappNumber = "5581985299617";
const sounds = {
  click: document.getElementById("soundClick"),
  add: document.getElementById("soundAdd"),
};

// --- Funções de Cálculo de Frete Dinâmico (Google Maps API) ---

async function initAutocomplete() {
  const inputEndereco = document.getElementById("inputEndereco");
  if (!inputEndereco) return;

  // Carrega a biblioteca de lugares de forma assíncrona (Padrão novo do Google)
  const { Autocomplete } = await google.maps.importLibrary("places");

  // Evita que o navegador tente sugerir endereços antigos do histórico
  inputEndereco.setAttribute("autocomplete", "new-password");

  const options = {
    componentRestrictions: { country: "br" },
    fields: ["geometry", "formatted_address"],
    types: ["address"],
  };

  autocomplete = new Autocomplete(inputEndereco, options);

  // O cálculo de taxa ocorre quando o usuário seleciona uma sugestão
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();

    if (!place || !place.geometry) {
      console.warn("Endereço digitado sem selecionar da lista.");
      return;
    }

    // Dispara o cálculo após a seleção confirmada
    atualizarTaxaEntrega();
  });
}

async function calcularTaxaPorDistancia() {
  if (!autocomplete) return 0;

  const place = autocomplete.getPlace();

  if (!place || !place.geometry) {
    return 0;
  }

  return new Promise((resolve) => {
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [new google.maps.LatLng(ORIGEM_COORD.lat, ORIGEM_COORD.lon)],
        destinations: [place.geometry.location],
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK") {
          const element = response.rows[0].elements[0];

          if (element.status !== "OK") {
            console.error("Erro ao traçar rota.");
            resolve(0);
            return;
          }

          const distanciaMetros = element.distance.value;

          // TABELA DE PREÇOS (Distância real por ruas)
          if (distanciaMetros <= 200) return resolve(0.0);
          if (distanciaMetros <= 500) return resolve(3.0);
          if (distanciaMetros <= 1000) return resolve(4.0);
          if (distanciaMetros <= 2000) return resolve(5.0);

          if (distanciaMetros > 5000) {
            alert("Desculpe, não entregamos para distâncias acima de 5km.");
            resolve(0);
          } else {
            resolve(6.0);
          }
        } else {
          console.error("Erro no Google Matrix:", status);
          resolve(0);
        }
      }
    );
  });
}

function setPendingMilkShake(name, price) {
  pendingMilkShake = { name, price };
  openPopup("popupCalda");
}

function playSound(type) {
  if (sounds[type]) sounds[type].play().catch(() => {});
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  loadMenuData();
});

async function loadMenuData() {
  try {
    const response = await fetch("cardapio.json");
    if (!response.ok) throw new Error("Erro HTTP");
    cardapioData = await response.json();
    showCategory("Promoções", document.querySelector(".sessao-topo button"));
  } catch (e) {
    console.error("Erro ao carregar cardápio:", e);
    document.getElementById("cardapio").innerHTML =
      "<p>Erro ao carregar cardápio.</p>";
  }
}

function salvarPedidoParaKDS(pedidoKDS) {
  // Comentado pois o firebase.js pode não existir
  /*
  enviarPedidoParaFirebase(pedidoKDS)
    .then(() => {
      console.log("Pedido enviado para o KDS (Firebase)");
    })
    .catch((err) => {
      console.error("Erro ao enviar pedido:", err);
    });
  */
  console.log("Pedido KDS:", pedidoKDS);
}

// --- Exibição do Cardápio ---
function showCategory(cat, btn) {
  currentCategory = cat;
  if (btn) {
    document
      .querySelectorAll(".sessao-topo button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    btn.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }
  const container = document.getElementById("cardapio");
  if (!container) return;

  container.innerHTML = "";
  const items = cardapioData[cat] || [];

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";

    if (item.img) {
      const img = document.createElement("img");
      img.src = item.img;
      img.onclick = () => openImagePopup(item.img);
      card.appendChild(img);
    }

    card.innerHTML += `<h3>${item.nome}</h3>`;
    if (item.descricao)
      card.innerHTML += `<div class="descricao">${item.descricao}</div>`;

    const optionsRow = document.createElement("div");
    optionsRow.className = "options-row";

    const opcoes = item.opcoes || [""];
    const precos = Array.isArray(item.precoBase)
      ? item.precoBase
      : [item.precoBase];

    opcoes.forEach((op, opIndex) => {
      let price = precos[opIndex] || precos[0];
      const btnOp = document.createElement("button");
      const textoBotao = `${op} - R$ ${parseFloat(price).toFixed(2)}`;

      const nomeOp = op.toLowerCase();
      const temIngredientes =
        item.ingredientes ||
        item.ingredientesPadrao ||
        (nomeOp.includes("simples") && item.simplesIngredients) ||
        (nomeOp.includes("duplo") && item.duploIngredients) ||
        (nomeOp.includes("triplo") && item.triploIngredients);
      const temPersonalizacao = !!(
        item.combo ||
        item.adicionais ||
        item.paidExtras ||
        temIngredientes
      );

      if (temPersonalizacao && cat !== "Milk Shakes") {
        btnOp.className = "btn-personalizar";
        btnOp.textContent = textoBotao;
        btnOp.onclick = () => openPopupCustom(cat, index, opIndex);
      } else {
        btnOp.className = "btn-add";
        btnOp.textContent = textoBotao;
        btnOp.onclick = () => {
          if (cat === "Milk Shakes") {
            pendingMilkShake = {
              name: item.nome + " " + op,
              price: parseFloat(price),
            };
            openPopup("popupCalda");
          } else {
            addToCart(item.nome + " " + op, parseFloat(price));
          }
        };
      }
      optionsRow.appendChild(btnOp);
    });
    card.appendChild(optionsRow);
    container.appendChild(card);
  });
}

// --- Carrinho ---
function addToCart(name, price, custom = {}) {
  playSound("add");
  const customKey = JSON.stringify(custom);
  const existingIndex = cart.findIndex(
    (c) => c.item === name.trim() && JSON.stringify(c.custom) === customKey
  );
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({ item: name.trim(), price: price, quantity: 1, custom: custom });
  }
  updateCartDisplay();
}

function updateCartDisplay() {
  const countEl = document.getElementById("cartCount");
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotalDisplay");

  const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const count = cart.reduce((acc, i) => acc + i.quantity, 0);

  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2)}`;

  if (itemsEl) {
    itemsEl.innerHTML = "";
    cart.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "cart-item";
      let details = generateCustomDetails(item.custom);
      div.innerHTML = `
        <div>
          <strong>${item.item}</strong><br/>
          ${details ? `<small style="color: #999">${details}</small><br/>` : ""}
          <small>R$ ${item.price.toFixed(2)}</small>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button onclick="changeQuantity(${idx}, -1)" style="padding: 4px 8px; background: #444; border: none; color: white; border-radius: 4px; cursor: pointer;">-</button>
          <span style="min-width: 20px; text-align: center;">${
            item.quantity
          }</span>
          <button onclick="changeQuantity(${idx}, 1)" style="padding: 4px 8px; background: #444; border: none; color: white; border-radius: 4px; cursor: pointer;">+</button>
          <button onclick="removeItem(${idx})" style="padding: 4px 8px; background: var(--vermelho); border: none; color: white; border-radius: 4px; cursor: pointer;">🗑️</button>
        </div>
      `;
      itemsEl.appendChild(div);
    });
  }

  updateUpsell();
}

function generateCustomDetails(custom) {
  if (!custom || Object.keys(custom).length === 0) return "";

  let parts = [];

  if (custom.removed && custom.removed.length > 0) {
    parts.push(`Sem: ${custom.removed.join(", ")}`);
  }

  if (custom.extras && custom.extras.length > 0) {
    const extraNames = custom.extras.map((e) => e.nome || e);
    parts.push(`Extras: ${extraNames.join(", ")}`);
  }

  if (custom.burgers && custom.burgers.length > 0) {
    custom.burgers.forEach((b, i) => {
      let burgerParts = [];
      if (b.removed && b.removed.length > 0) {
        burgerParts.push(`Sem ${b.removed.join(", ")}`);
      }
      if (b.extras && b.extras.length > 0) {
        const extraNames = b.extras.map((e) => e.nome || e);
        burgerParts.push(`+${extraNames.join(", ")}`);
      }
      if (burgerParts.length > 0) {
        parts.push(`${b.burgerName}: ${burgerParts.join(" | ")}`);
      }
    });
  }

  return parts.join(" • ");
}

function toggleCart() {
  playSound("click");
  document.getElementById("footerCart").classList.toggle("open");
}

function removeItem(idx) {
  cart.splice(idx, 1);
  updateCartDisplay();
}

function changeQuantity(idx, delta) {
  if (cart[idx]) {
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) {
      cart.splice(idx, 1);
    }
    updateCartDisplay();
  }
}

function clearCart() {
  if (confirm("Deseja limpar todo o carrinho?")) {
    cart = [];
    updateCartDisplay();
  }
}

// --- Upsell ---
function updateUpsell() {
  const upsellContainer = document.getElementById("upsellContainer");
  const upsellList = document.getElementById("upsellList");

  if (!upsellContainer || !upsellList) return;

  const categoriesInCart = new Set(
    cart.map((c) => {
      if (c.item.toLowerCase().includes("combo")) return "Combos";
      if (c.item.toLowerCase().includes("batata")) return "Batata Frita";
      if (c.item.toLowerCase().includes("bebida")) return "Bebidas";
      if (c.item.toLowerCase().includes("shake")) return "Milk Shakes";
      return "Artesanais";
    })
  );

  const hasBurger =
    categoriesInCart.has("Artesanais") || categoriesInCart.has("Combos");
  const hasFries = categoriesInCart.has("Batata Frita");
  const hasDrink = categoriesInCart.has("Bebidas");

  let suggestions = [];

  if (hasBurger && !hasFries && cardapioData["Batata Frita"]) {
    suggestions.push(...cardapioData["Batata Frita"].slice(0, 2));
  }

  if (hasBurger && !hasDrink && cardapioData["Bebidas"]) {
    suggestions.push(...cardapioData["Bebidas"].slice(0, 2));
  }

  if (!hasBurger && cardapioData["Promoções"]) {
    suggestions.push(...cardapioData["Promoções"].slice(0, 2));
  }

  if (suggestions.length === 0) {
    upsellContainer.style.display = "none";
    return;
  }

  upsellContainer.style.display = "block";
  upsellList.innerHTML = "";

  suggestions.forEach((item) => {
    const price = Array.isArray(item.precoBase)
      ? item.precoBase[0]
      : item.precoBase;
    const card = document.createElement("div");
    card.className = "upsell-card";
    card.innerHTML = `
      <img src="${item.img || "img/default.png"}" alt="${item.nome}" />
      <h4>${item.nome}</h4>
      <div class="price">R$ ${parseFloat(price).toFixed(2)}</div>
      <button onclick="addToCart('${item.nome}', ${parseFloat(
      price
    )})">+ Add</button>
    `;
    upsellList.appendChild(card);
  });
}

// --- Milk Shake Calda ---
function selectCalda(calda) {
  if (pendingMilkShake) {
    addToCart(
      pendingMilkShake.name + " - Calda de " + calda,
      pendingMilkShake.price
    );
    pendingMilkShake = null;
    closeCaldaPopup();
  }
}

function closeCaldaPopup() {
  closeModal("popupCalda");
}

// --- Modais ---
function openPopup(id) {
  const backdrop = document.getElementById("backdrop");
  const popup = document.getElementById(id);
  if (backdrop) backdrop.classList.add("show");
  if (popup) {
    popup.classList.add("show");
    popup.scrollTop = 0;
  }
}

function closeModal(id) {
  const backdrop = document.getElementById("backdrop");
  const popup = document.getElementById(id);
  if (backdrop) backdrop.classList.remove("show");
  if (popup) popup.classList.remove("show");
}

function openImagePopup(imgSrc) {
  const img = document.getElementById("enlargedImage");
  if (img) img.src = imgSrc;
  openPopup("popupImage");
}

function closeImagePopup() {
  closeModal("popupImage");
}

// --- Customização Simples ---
function openPopupCustom(cat, itemIdx, opIdx) {
  currentItem = { cat, itemIdx, opIdx };
  const item = cardapioData[cat][itemIdx];

  if (item.combo) {
    startComboCustomization(item, opIdx);
    return;
  }

  const container = document.getElementById("popupQuestion");
  const popup = document.getElementById("popupCustom");

  document.getElementById(
    "popupCustomTitle"
  ).textContent = `Personalize: ${item.nome}`;
  container.innerHTML = "";

  let ingredientes = [];
  const nomeOp = (item.opcoes && item.opcoes[opIdx]) || "";

  if (nomeOp.toLowerCase().includes("simples") && item.simplesIngredients) {
    ingredientes = item.simplesIngredients;
  } else if (nomeOp.toLowerCase().includes("duplo") && item.duploIngredients) {
    ingredientes = item.duploIngredients;
  } else if (
    nomeOp.toLowerCase().includes("triplo") &&
    item.triploIngredients
  ) {
    ingredientes = item.triploIngredients;
  } else {
    ingredientes = item.ingredientes || item.ingredientesPadrao || [];
  }

  if (ingredientes.length > 0) {
    container.innerHTML += "<h4>Remover ingredientes:</h4>";
    ingredientes.forEach((ing) => {
      container.innerHTML += `<label><input type="checkbox" data-type="remove" value="${ing}" /><span>Sem ${ing}</span></label>`;
    });
  }

  const adicionais = item.adicionais || [];
  if (adicionais.length > 0) {
    container.innerHTML += "<h4>Adicionais grátis:</h4>";
    adicionais.forEach((ad) => {
      container.innerHTML += `<label><input type="checkbox" data-type="adicional" value="${ad}" /><span>${ad}</span></label>`;
    });
  }

  const paidExtras = item.paidExtras || [];
  if (paidExtras.length > 0) {
    container.innerHTML += "<h4>Adicionais pagos:</h4>";
    paidExtras.forEach((ext) => {
      container.innerHTML += `<label><input type="checkbox" data-type="extra" data-price="${
        ext.preco
      }" value="${ext.nome}" /><span>${ext.nome} (+R$ ${ext.preco.toFixed(
        2
      )})</span></label>`;
    });
  }

  openPopup("popupCustom");
  popup.scrollTop = 0;
}

function confirmSimpleCustom() {
  const { cat, itemIdx, opIdx } = currentItem;
  const item = cardapioData[cat][itemIdx];
  const container = document.getElementById("popupQuestion");

  const removed = Array.from(
    container.querySelectorAll('input[data-type="remove"]:checked')
  ).map((i) => i.value);

  const adicionais = Array.from(
    container.querySelectorAll('input[data-type="adicional"]:checked')
  ).map((i) => i.value);

  const extras = Array.from(
    container.querySelectorAll('input[data-type="extra"]:checked')
  ).map((i) => ({ nome: i.value, preco: parseFloat(i.dataset.price) }));

  const nomeOpcao = item.opcoes ? item.opcoes[opIdx] : "";
  const precos = Array.isArray(item.precoBase)
    ? item.precoBase
    : [item.precoBase];
  const price = precos[opIdx] || precos[0];

  const extrasTotal = extras.reduce((sum, e) => sum + e.preco, 0);

  addToCart(item.nome + " " + nomeOpcao, parseFloat(price) + extrasTotal, {
    removed,
    extras,
  });
  closeModal("popupCustom");
}

function startComboCustomization(item, opIdx) {
  const precos = Array.isArray(item.precoBase)
    ? item.precoBase
    : [item.precoBase];
  comboCustomization = {
    item,
    basePrice: parseFloat(precos[opIdx] || precos[0]),
    currentBurgerIndex: 0,
    totalCustomizations: [],
    optionName: item.opcoes ? item.opcoes[opIdx] : "",
    paidExtras: item.paidExtras || [],
  };
  renderComboStep();
}

function renderComboStep() {
  const { item, currentBurgerIndex, paidExtras } = comboCustomization;
  const burgerName = item.burgers[currentBurgerIndex];
  const container = document.getElementById("popupQuestion");
  const popup = document.getElementById("popupCustom");

  document.getElementById("popupCustomTitle").textContent = `Lanche ${
    currentBurgerIndex + 1
  }: ${burgerName}`;
  container.innerHTML = "<h4>Personalize este lanche:</h4>";

  let ings = [];
  if (burgerName.toLowerCase().includes("simples")) {
    ings = item.simplesIngredients || [];
  } else if (burgerName.toLowerCase().includes("duplo")) {
    ings = item.duploIngredients || [];
  }
  if (ings.length === 0) {
    ings = ["Cebola caramelizada", "Molho artesanal", "Cheddar fatiado"];
  }

  ings.forEach((ing) => {
    container.innerHTML += `<label><input type="checkbox" data-type="remove-combo" value="${ing}" /><span>Sem ${ing}</span></label>`;
  });

  if (paidExtras.length > 0) {
    container.innerHTML += "<h4>Adicionais:</h4>";
    paidExtras.forEach((ext) => {
      container.innerHTML += `<label><input type="checkbox" data-type="extra-combo" data-price="${
        ext.preco
      }" value="${ext.nome}" /><span>${ext.nome} (+R$ ${ext.preco.toFixed(
        2
      )})</span></label>`;
    });
  }

  const btn = document.querySelector("#popupCustom .btn-primary");
  btn.onclick = nextComboStep;
  btn.textContent =
    currentBurgerIndex < item.burgers.length - 1
      ? "Próximo Lanche"
      : "Adicionar ao Carrinho";

  openPopup("popupCustom");
  popup.scrollTop = 0;
}

function nextComboStep() {
  const container = document.getElementById("popupQuestion");
  const removed = Array.from(
    container.querySelectorAll('input[data-type="remove-combo"]:checked')
  ).map((i) => i.value);

  const extras = Array.from(
    container.querySelectorAll('input[data-type="extra-combo"]:checked')
  ).map((i) => ({ nome: i.value, preco: parseFloat(i.dataset.price) }));

  comboCustomization.totalCustomizations.push({
    burgerName:
      comboCustomization.item.burgers[comboCustomization.currentBurgerIndex],
    removed,
    extras,
  });

  comboCustomization.currentBurgerIndex++;

  if (
    comboCustomization.currentBurgerIndex <
    comboCustomization.item.burgers.length
  ) {
    renderComboStep();
  } else {
    let extrasTotal = 0;
    comboCustomization.totalCustomizations.forEach((b) => {
      if (b.extras) {
        extrasTotal += b.extras.reduce((sum, e) => sum + e.preco, 0);
      }
    });

    addToCart(
      comboCustomization.item.nome + " " + comboCustomization.optionName,
      comboCustomization.basePrice + extrasTotal,
      { burgers: comboCustomization.totalCustomizations }
    );
    closeModal("popupCustom");
  }
}

// --- Checkout ---
function iniciarCheckout() {
  if (!cart.length) return;
  document.getElementById("footerCart").classList.remove("open");
  openPopup("modalModoEntrega");
}

function selecionarModo(modo) {
  modeEntrega = modo;
  closeModal("modalModoEntrega");

  if (modo === "entrega") {
    // Salva o carrinho atual para ser lido na página de checkout
    localStorage.setItem("ribbs_cart", JSON.stringify(cart));
    window.location.href = "checkout.html";
  } else {
    // Mantém o fluxo antigo para retirada local
    document.getElementById("areaEntrega").style.display = "none";
    document.getElementById("linhaTaxa").style.display = "none";
    taxaEntregaAtual = 0;
    atualizarTaxaEntrega();
    openPopup("modalDados");
  }
}

async function atualizarTaxaEntrega() {
  let taxa = 0;
  const selBairro = document.getElementById("selectBairro");
  const bairroSelecionado = selBairro ? selBairro.value : "";
  const resumoTaxaDisplay = document.getElementById("resumoTaxa");

  if (modeEntrega === "entrega") {
    const place = autocomplete ? autocomplete.getPlace() : null;

    if (bairroSelecionado === "Campo Grande" && place && place.geometry) {
      if (resumoTaxaDisplay) resumoTaxaDisplay.textContent = "Calculando...";
      taxa = await calcularTaxaPorDistancia();
    } else if (selBairro && selBairro.selectedIndex > 0) {
      taxa = parseFloat(
        selBairro.options[selBairro.selectedIndex]?.dataset.taxa || 0
      );
    }
  }

  taxaEntregaAtual = taxa;
  const sub = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

  if (document.getElementById("resumoSubtotal"))
    document.getElementById("resumoSubtotal").textContent = `R$ ${sub.toFixed(
      2
    )}`;

  if (resumoTaxaDisplay)
    resumoTaxaDisplay.textContent = `R$ ${taxa.toFixed(2)}`;

  if (document.getElementById("resumoTotal"))
    document.getElementById("resumoTotal").textContent = `R$ ${(
      sub + taxa
    ).toFixed(2)}`;
}

function verificarTroco() {
  const areaTroco = document.getElementById("areaTroco");
  if (areaTroco) {
    areaTroco.style.display =
      document.getElementById("selectPagamento").value === "Dinheiro"
        ? "block"
        : "none";
  }
}

function enviarZap(e) {
  e.preventDefault();
  const nome = document.getElementById("inputNome").value;
  const pag = document.getElementById("selectPagamento").value;
  const totalTexto = document.getElementById("resumoTotal").textContent;
  const totalNumerico = parseFloat(
    totalTexto.replace("R$", "").replace(",", ".").trim()
  );

  salvarPedidoParaKDS({
    id: Date.now().toString(),
    nomeCliente: nome,
    itens: cart.map((c) => ({
      item: c.item,
      quantity: c.quantity,
      custom: c.custom,
    })),
    pagamentos: [{ method: pag, value: totalNumerico }],
    total: totalNumerico,
    tipoConsumo: modeEntrega === "entrega" ? "Para Viagem" : "Consumo Local",
    status: "Pendente",
    dataHora: new Date().toLocaleTimeString(),
    observacao: "",
  });

  let msg = `*PEDIDO RIBBSZN - ${modeEntrega.toUpperCase()}*%0a*Cliente:* ${nome}%0a`;
  if (modeEntrega === "entrega") {
    const endereco = document.getElementById("inputEndereco").value;
    const bairro = document.getElementById("selectBairro").value;
    msg += `*Endereço:* ${endereco}%0a*Bairro:* ${bairro}%0a`;
  }

  msg += `%0a*ITENS:*%0a`;
  cart.forEach((c) => {
    msg += `• ${c.quantity}x ${c.item}%0a`;
    let det = generateCustomDetails(c.custom);
    if (det) msg += `   _${det}_%0a`;
  });

  msg += `%0a*Pagamento:* ${pag}%0a*TOTAL:* ${totalTexto}`;

  window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");

  cart = [];
  updateCartDisplay();
  closeModal("modalDados");
  document.getElementById("footerCart").classList.remove("open");
  e.target.reset();
  showCategory("Promoções", document.querySelector(".sessao-topo button"));
}

// --- Exposição de funções para o escopo Global ---
window.showCategory = showCategory;
window.toggleCart = toggleCart;
window.removeItem = removeItem;
window.changeQuantity = changeQuantity;
window.clearCart = clearCart;
window.iniciarCheckout = iniciarCheckout;
window.selectCalda = selectCalda;
window.closeCaldaPopup = closeCaldaPopup;
window.selecionarModo = selecionarModo;
window.atualizarTaxaEntrega = atualizarTaxaEntrega;
window.verificarTroco = verificarTroco;
window.enviarZap = enviarZap;
window.closeImagePopup = closeImagePopup;
window.addToCart = addToCart;
window.openPopup = openPopup;
window.closeModal = closeModal;
window.openPopupCustom = openPopupCustom;
window.confirmSimpleCustom = confirmSimpleCustom;
window.setPendingMilkShake = setPendingMilkShake;
window.startComboCustomization = startComboCustomization;
window.renderComboStep = renderComboStep;
window.nextComboStep = nextComboStep;
window.initAutocomplete = initAutocomplete;
window.openImagePopup = openImagePopup;

export { initAutocomplete };
