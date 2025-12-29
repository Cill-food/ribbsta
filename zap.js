"use strict";

// --- Variáveis Globais ---
let cardapioData = {};
let cart = [];
let currentCategory = "Promoções";
let currentItem = null;
let pendingMilkShake = null;
let modeEntrega = "";

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
    console.error("Erro ao carregar cardapio:", e);
    document.getElementById("cardapio").innerHTML =
      "<p>Erro ao carregar cardápio.</p>";
  }
}

function salvarPedidoParaKDS(pedidoKDS) {
  // O KDS monitora 'kds_orders', se salvar em 'pedidos' ele não verá!
  const pedidosExistentes = JSON.parse(
    localStorage.getItem("kds_orders") || "[]"
  );
  pedidosExistentes.push(pedidoKDS);
  localStorage.setItem("kds_orders", JSON.stringify(pedidosExistentes));

  // Isso avisa o KDS para atualizar a tela e tocar o som imediatamente
  window.dispatchEvent(new Event("storage"));
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
  cart.push({ item: name.trim(), price: price, quantity: 1, custom: custom });
  updateCartDisplay();
}

function updateCartDisplay() {
  const countSpan = document.getElementById("cartCount");
  const totalSpan = document.getElementById("cartTotalDisplay");
  const container = document.getElementById("cartItems");
  const cartIcon = document.getElementById("cartIcon");
  const footer = document.getElementById("footerCart");

  const total = cart.reduce((acc, item) => acc + item.price, 0);
  countSpan.textContent = cart.length;

  if (totalSpan) totalSpan.textContent = `R$ ${total.toFixed(2)}`;

  if (footer.classList.contains("open")) {
    cartIcon.innerHTML = "🛒";
  } else {
    cartIcon.innerHTML = "🛒";
  }

  container.innerHTML = "";
  cart.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${c.item}</strong><br>
        <span style="font-size:0.75em; color:#aaa">${generateCustomDetails(
          c.custom
        )}</span>
        <div>R$ ${c.price.toFixed(2)}</div>
      </div>
      <button onclick="removeItem(${i})" style="background:none; border:none; color:var(--vermelho); font-size:1.2em; cursor:pointer">🗑️</button>
    `;
    container.appendChild(div);
  });
}

function toggleCart() {
  document.getElementById("footerCart").classList.toggle("open");
  updateCartDisplay();
}

function removeItem(index) {
  cart.splice(index, 1);
  updateCartDisplay();
}

function clearCart() {
  if (confirm("Limpar carrinho?")) {
    cart = [];
    updateCartDisplay();
  }
}

function generateCustomDetails(custom) {
  if (!custom) return "";
  let parts = [];
  if (custom.burgers) {
    custom.burgers.forEach((b) => {
      let mods = [];
      if (b.removed?.length) mods.push("Sem " + b.removed.join(", "));
      if (b.extras?.length)
        mods.push("Add: " + b.extras.map((e) => e.nome).join(", "));
      parts.push(
        `${b.burgerName} ${mods.length ? "(" + mods.join("; ") + ")" : ""}`
      );
    });
  } else {
    if (custom.calda) parts.push("Calda: " + custom.calda);
    if (custom.removed?.length) parts.push("Sem: " + custom.removed.join(", "));
    if (custom.extras?.length)
      parts.push("Add: " + custom.extras.map((e) => e.nome).join(", "));
  }
  return parts.join(" | ");
}

// --- Modais ---
function openPopup(id) {
  const backdrop = document.getElementById("backdrop");
  const popup = document.getElementById(id);

  backdrop.style.display = "block";
  popup.style.display = "block";

  // Força reflow para garantir que a transição funcione
  void popup.offsetHeight;

  // Ativa as classes de animação
  backdrop.classList.add("show");
  popup.classList.add("show");
}

function closeModal(id) {
  const backdrop = document.getElementById("backdrop");
  const popup = document.getElementById(id);

  if (popup) {
    // Remove a classe de animação do modal específico
    popup.classList.remove("show");
  }

  // Verifica se ainda existe algum outro modal aberto com a classe 'show'
  // Isso evita que o fundo (blur) suma se você abrir um modal por cima de outro
  const openPopups = document.querySelectorAll(".popup.show");

  if (openPopups.length === 0) {
    // Se não houver mais modais abertos, remove o blur do fundo
    backdrop.classList.remove("show");

    // Espera a animação de fade/blur terminar (300ms) antes de dar display: none
    setTimeout(() => {
      backdrop.style.display = "none";
      if (popup) popup.style.display = "none";
    }, 300);
  } else {
    // Se ainda houver modais, apenas esconde o modal atual imediatamente
    if (popup) {
      setTimeout(() => {
        popup.style.display = "none";
      }, 300);
    }
  }
}

// --- Personalização ---
function openPopupCustom(cat, itemIndex, optionIndex) {
  currentItem = { cat, itemIndex, optionIndex };
  const item = cardapioData[cat][itemIndex];
  if (item.combo && item.burgers) {
    startComboCustomization(item, optionIndex);
    return;
  }

  const container = document.getElementById("popupQuestion");
  const nomeOpcao = item.opcoes ? item.opcoes[optionIndex] : "";
  document.getElementById("popupCustomTitle").textContent =
    "Personalizar: " + item.nome + " " + nomeOpcao;
  container.innerHTML = "";

  let ingredientes = item.ingredientes || item.ingredientesPadrao;

  if (item.ingredientesPorOpcao && item.ingredientesPorOpcao[nomeOpcao]) {
    ingredientes = item.ingredientesPorOpcao[nomeOpcao];
  } else {
    const opLower = nomeOpcao.toLowerCase();
    if (opLower.includes("simples") && item.simplesIngredients) {
      ingredientes = item.simplesIngredients;
    } else if (opLower.includes("duplo") && item.duploIngredients) {
      ingredientes = item.duploIngredients;
    } else if (opLower.includes("triplo") && item.triploIngredients) {
      ingredientes = item.triploIngredients;
    }
  }

  if (ingredientes && ingredientes.length > 0) {
    container.innerHTML += "<h4>Retirar Ingredientes:</h4>";
    ingredientes.forEach((ing) => {
      container.innerHTML += `<label><input type="checkbox" data-type="remove" value="${ing}"><span>Retirar ${ing}</span></label>`;
    });
  }

  const extras = item.paidExtras || item.adicionais || [];
  if (extras.length > 0) {
    container.innerHTML += "<h4>Adicionais:</h4>";
    extras.forEach((ext) => {
      container.innerHTML += `<label><input type="checkbox" data-type="extra" data-price="${
        ext.preco
      }" value="${ext.nome}"><span>${ext.nome} (+R$ ${ext.preco.toFixed(
        2
      )})</span></label>`;
    });
  }

  document.querySelector("#popupCustom .btn-primary").onclick =
    confirmSimpleCustom;
  openPopup("popupCustom");
}

function confirmSimpleCustom() {
  const item = cardapioData[currentItem.cat][currentItem.itemIndex];
  const precos = Array.isArray(item.precoBase)
    ? item.precoBase
    : [item.precoBase];
  const price = precos[currentItem.optionIndex] || precos[0];
  const nomeOpcao = item.opcoes ? item.opcoes[currentItem.optionIndex] : "";

  const container = document.getElementById("popupQuestion");
  const removed = Array.from(
    container.querySelectorAll('input[data-type="remove"]:checked')
  ).map((i) => i.value);
  const extras = Array.from(
    container.querySelectorAll('input[data-type="extra"]:checked')
  ).map((i) => ({ nome: i.value, preco: parseFloat(i.dataset.price) }));
  const extrasTotal = extras.reduce((sum, e) => sum + e.preco, 0);

  addToCart(item.nome + " " + nomeOpcao, parseFloat(price) + extrasTotal, {
    removed,
    extras,
  });
  closeModal("popupCustom");
}

// --- Combos ---
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
    container.innerHTML += `<label><input type="checkbox" data-type="remove-combo" value="${ing}"><span>Sem ${ing}</span></label>`;
  });

  if (paidExtras.length > 0) {
    container.innerHTML += "<h4>Adicionais:</h4>";
    paidExtras.forEach((ext) => {
      container.innerHTML += `<label><input type="checkbox" data-type="extra-combo" data-price="${
        ext.preco
      }" value="${ext.nome}"><span>${ext.nome} (+R$ ${ext.preco.toFixed(
        2
      )})</span></label>`;
    });
  }

  const btn = document.querySelector("#popupCustom .btn-primary");
  btn.onclick = nextComboStep;
  btn.textContent =
    currentBurgerIndex < item.burgers.length - 1
      ? "Próximo Lanche"
      : "Finalizar Combo";

  openPopup("popupCustom");

  // Rola para o topo do modal
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
// --- Alterado para fechar o carrinho ao iniciar o checkout ---
function iniciarCheckout() {
  if (!cart.length) return;

  // Minimiza o carrinho
  document.getElementById("footerCart").classList.remove("open");

  // Abre o primeiro modal (Modo de Entrega)
  openPopup("modalModoEntrega");
}

// --- Alterado para fechar o carrinho ao limpar tudo ---
function clearCart() {
  if (confirm("Limpar carrinho?")) {
    cart = [];

    // Minimiza o carrinho removendo a classe 'open'
    document.getElementById("footerCart").classList.remove("open");

    updateCartDisplay();
  }
}

// Suas outras funções permanecem iguais
function selecionarModo(modo) {
  modeEntrega = modo;
  closeModal("modalModoEntrega");
  document.getElementById("areaEntrega").style.display =
    modo === "entrega" ? "block" : "none";
  document.getElementById("linhaTaxa").style.display =
    modo === "entrega" ? "flex" : "none";
  atualizarTaxaEntrega();
  openPopup("modalDados");
}

function atualizarTaxaEntrega() {
  let taxa = 0;
  if (modeEntrega === "entrega") {
    const sel = document.getElementById("selectBairro");
    taxa = parseFloat(sel.options[sel.selectedIndex]?.dataset.taxa || 0);
  }
  const sub = cart.reduce((acc, i) => acc + i.price, 0);
  document.getElementById("resumoSubtotal").textContent = `R$ ${sub.toFixed(
    2
  )}`;
  document.getElementById("resumoTaxa").textContent = `R$ ${taxa.toFixed(2)}`;
  document.getElementById("resumoTotal").textContent = `R$ ${(
    sub + taxa
  ).toFixed(2)}`;
}

function verificarTroco() {
  document.getElementById("areaTroco").style.display =
    document.getElementById("selectPagamento").value === "Dinheiro"
      ? "block"
      : "none";
}

function enviarZap(e) {
  e.preventDefault();
  const nome = document.getElementById("inputNome").value;
  const pag = document.getElementById("selectPagamento").value;

  // Cálculo do total para o KDS
  const totalTexto = document.getElementById("resumoTotal").textContent;
  const totalNumerico = parseFloat(
    totalTexto.replace("R$", "").replace(",", ".").trim()
  );

  // Envio detalhado para o KDS compatível com kds.js
  salvarPedidoParaKDS({
    id: Date.now().toString(), // KDS espera ID único
    nomeCliente: nome, // kds.js usa 'nomeCliente'
    itens: cart.map((c) => ({
      item: c.item,
      quantity: c.quantity,
      custom: c.custom, // Envia o objeto original para a função formatDetails do KDS
    })),
    pagamentos: [
      {
        // kds.js espera um array de pagamentos
        method: pag,
        value: totalNumerico,
      },
    ],
    total: totalNumerico,
    tipoConsumo: modeEntrega === "entrega" ? "Para Viagem" : "Consumo Local", // Ativa os badges no KDS
    status: "Pendente", // Status inicial compatível com CSS do KDS
    dataHora: new Date().toLocaleTimeString(),
    observacao: "", // Inicializa campo de observação
  });

  // Montagem da mensagem do WhatsApp
  let msg = `*PEDIDO RIBBSZN - ${modeEntrega.toUpperCase()}*%0a*Cliente:* ${nome}%0a`;
  if (modeEntrega === "entrega")
    msg += `*Endereço:* ${document.getElementById("inputRua").value}, ${
      document.getElementById("selectBairro").value
    }%0a`;

  msg += `%0a*ITENS:*%0a`;
  cart.forEach((c) => {
    msg += `• ${c.quantity}x ${c.item}%0a`;
    let det = generateCustomDetails(c.custom);
    if (det) msg += `   _${det}_%0a`;
  });

  msg += `%0a*Pagamento:* ${pag}%0a*TOTAL:* ${totalTexto}`;

  // Abre o WhatsApp
  window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");

  // --- RESET DO TOTEM ---
  cart = [];
  updateCartDisplay();
  closeModal("modalDados");
  document.getElementById("footerCart").classList.remove("open");
  e.target.reset();

  // Volta para a categoria inicial
  showCategory("Promoções", document.querySelector(".sessao-topo button"));
}
