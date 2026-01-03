"use strict";

// --- Variáveis Globais ---
let cardapioData = {};
let cart = [];
let currentCategory = "Promoções";
let currentItem = null;
let pendingMilkShake = null;
let modoEntrega = "";
let taxaEntregaAtual = 0;
let desconto = 0;

// --- Configurações ---
const whatsappNumber = "5581985299617";
const CHAVE_PIX_TEXTO = "81985299617"; // Número para cópia

let comboCustomization = {
  item: null,
  currentBurgerIndex: -1,
  totalCustomizations: [],
  basePrice: 0,
  optionName: "",
  paidExtras: [],
};

const sounds = {
  click: document.getElementById("soundClick"),
  add: document.getElementById("soundAdd"),
};

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  loadMenuData();

  const inputCupom = document.getElementById("inputCupom");
  if (inputCupom) {
    inputCupom.addEventListener("input", aplicarCupom);
  }
});

async function loadMenuData() {
  try {
    const response = await fetch("cardapio.json");
    cardapioData = await response.json();
    // Inicia na categoria Promoções
    const firstBtn = document.querySelector(".sessao-topo button");
    showCategory("Promoções", firstBtn);
  } catch (e) {
    console.error(
      "Erro ao carregar cardápio. Verifique se o arquivo cardapio.json existe."
    );
  }
}

// --- Funções de Cupom e Resumo ---
function aplicarCupom() {
  const codigo = document.getElementById("inputCupom").value.toUpperCase();
  const sub = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  desconto = 0;

  if (codigo === "DESCONTO10") {
    desconto = sub * 0.1;
  }
  atualizarResumo();
}

function atualizarResumo() {
  const sub = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const totalFinal = Math.max(0, sub + taxaEntregaAtual - desconto);

  document.getElementById("resumoSubtotal").textContent = `R$ ${sub.toFixed(
    2
  )}`;

  const resumoTaxa = document.getElementById("resumoTaxa");
  const selectBairro = document.getElementById("selectBairro");
  const bairro = selectBairro ? selectBairro.value : "";

  if (modoEntrega === "entrega" && bairro === "Campo Grande") {
    resumoTaxa.innerHTML = `<span style="color: #ff4444; font-weight: bold;">A definir (No WhatsApp)</span>`;
  } else {
    resumoTaxa.textContent = `R$ ${taxaEntregaAtual.toFixed(2)}`;
  }

  document.getElementById(
    "resumoDesconto"
  ).textContent = `R$ ${desconto.toFixed(2)}`;
  document.getElementById("resumoTotal").textContent = `R$ ${totalFinal.toFixed(
    2
  )}`;
}

// --- Lógica de Pagamento e Pix ---
function gerenciarExibicaoPix() {
  const pag = document.getElementById("selectPagamento").value;
  const areaPix = document.getElementById("areaPixCopiaCola");
  if (areaPix) {
    areaPix.style.display = pag === "Pix" ? "block" : "none";
  }
}

function copiarChavePix() {
  navigator.clipboard
    .writeText(CHAVE_PIX_TEXTO)
    .then(() => {
      alert("Chave PIX copiada: " + CHAVE_PIX_TEXTO);
    })
    .catch((err) => {
      console.error("Erro ao copiar: ", err);
    });
}

function verificarTroco() {
  const pag = document.getElementById("selectPagamento").value;
  const areaTroco = document.getElementById("areaTroco");
  if (areaTroco) {
    areaTroco.style.display = pag === "Dinheiro" ? "block" : "none";
  }
}

// --- Checkout e Entrega ---
function selecionarModo(modo) {
  modoEntrega = modo;
  const areaEntrega = document.getElementById("areaEntrega");
  const secaoPagamento = document.getElementById("secaoPagamento");

  if (modo === "retirada") {
    areaEntrega.style.display = "none";
    taxaEntregaAtual = 0;
    secaoPagamento.style.display = "block";
  } else {
    areaEntrega.style.display = "block";
  }
  closeModal("modalModoEntrega");
  openPopup("modalDados");
  atualizarResumo();
}

function atualizarTaxaEntrega() {
  const selectBairro = document.getElementById("selectBairro");
  const secaoPagamento = document.getElementById("secaoPagamento");
  const areaPixCopiaCola = document.getElementById("areaPixCopiaCola");
  const bairro = selectBairro.value;

  if (modoEntrega === "retirada") {
    taxaEntregaAtual = 0;
    secaoPagamento.style.display = "block";
  } else {
    if (bairro === "Campo Grande") {
      taxaEntregaAtual = 0;
      secaoPagamento.style.display = "none";
      alert(
        "Para Campo Grande, a taxa de entrega é sob consulta (calculada por distância). O pagamento será combinado no WhatsApp."
      );
    } else {
      const option = selectBairro.selectedOptions[0];
      taxaEntregaAtual = parseFloat(option.getAttribute("data-taxa") || 0);
      secaoPagamento.style.display = "block";
    }
  }
  if (areaPixCopiaCola) areaPixCopiaCola.style.display = "none";
  atualizarResumo();
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
      const price = precos[opIndex] || precos[0];
      const btnOp = document.createElement("button");
      btnOp.innerHTML = `<span>${op}</span> <span>R$ ${parseFloat(
        price
      ).toFixed(2)}</span>`;

      const categoriasComModal = [
        "Artesanais",
        "Promoções",
        "Batata Frita",
        "Costela Bovina",
      ];
      const temPersonalizacao = !!(
        item.ingredientes ||
        item.ingredientesPadrao ||
        item.paidExtras ||
        item.adicionais ||
        item.combo
      );

      if (categoriasComModal.includes(cat) || temPersonalizacao) {
        btnOp.className = "btn-personalizar";
        btnOp.onclick = () => openPopupCustom(cat, index, opIndex);
      } else {
        btnOp.className = "btn-add";
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

// --- Customização ---
function openPopupCustom(cat, itemIdx, opIdx) {
  currentItem = { cat, itemIdx, opIdx };
  const item = cardapioData[cat][itemIdx];
  const opNome = (item.opcoes && item.opcoes[opIdx]) || "";

  if (item.combo) {
    startComboCustomization(item, opIdx);
    return;
  }

  const container = document.getElementById("popupQuestion");
  document.getElementById(
    "popupCustomTitle"
  ).textContent = `Personalizar: ${item.nome} ${opNome}`;
  container.innerHTML = "";

  let ings =
    (item.ingredientesPorOpcao && item.ingredientesPorOpcao[opNome]) ||
    item.ingredientes ||
    item.ingredientesPadrao ||
    [];

  if (ings.length > 0) {
    container.innerHTML += "<h4>Remover:</h4>";
    ings.forEach((ing) => {
      container.innerHTML += `<label><input type="checkbox" data-type="remove" value="${ing}"><span>Sem ${ing}</span></label>`;
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

  const btnConfirm = document.querySelector("#popupCustom .btn-primary");
  btnConfirm.onclick = confirmSimpleCustom;
  openPopup("popupCustom");
}

function confirmSimpleCustom() {
  const item = cardapioData[currentItem.cat][currentItem.itemIdx];
  const opNome = item.opcoes[currentItem.opIdx];
  const precoBase = Array.isArray(item.precoBase)
    ? item.precoBase[currentItem.opIdx]
    : item.precoBase;

  const container = document.getElementById("popupQuestion");
  const removed = Array.from(
    container.querySelectorAll('input[data-type="remove"]:checked')
  ).map((i) => i.value);
  const extras = Array.from(
    container.querySelectorAll('input[data-type="extra"]:checked')
  ).map((i) => ({
    nome: i.value,
    preco: parseFloat(i.dataset.price),
  }));

  const extraTotal = extras.reduce((acc, e) => acc + e.preco, 0);
  addToCart(`${item.nome} ${opNome}`, precoBase + extraTotal, {
    removed,
    extras,
  });
  closeModal("popupCustom");
}

// --- Combo Logic ---
function startComboCustomization(item, opIdx) {
  comboCustomization = {
    item: item,
    currentBurgerIndex: 0,
    totalCustomizations: [],
    basePrice: item.precoBase[opIdx],
    optionName: item.opcoes[opIdx],
    paidExtras: item.paidExtras || [],
  };
  renderComboStep();
}

function renderComboStep() {
  const { item, currentBurgerIndex, paidExtras } = comboCustomization;
  const burgerName = item.burgers[currentBurgerIndex];
  const container = document.getElementById("popupQuestion");

  document.getElementById("popupCustomTitle").textContent = `Lanche ${
    currentBurgerIndex + 1
  }: ${burgerName}`;
  container.innerHTML = "<h4>Remover:</h4>";

  let ings = burgerName.toLowerCase().includes("duplo")
    ? item.duploIngredients || []
    : item.simplesIngredients || [];

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
      : "Adicionar ao Carrinho";
  openPopup("popupCustom");
}

function nextComboStep() {
  const container = document.getElementById("popupQuestion");
  const removed = Array.from(
    container.querySelectorAll('input[data-type="remove-combo"]:checked')
  ).map((i) => i.value);
  const extras = Array.from(
    container.querySelectorAll('input[data-type="extra-combo"]:checked')
  ).map((i) => ({
    nome: i.value,
    preco: parseFloat(i.dataset.price),
  }));

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
    let extrasTotal = comboCustomization.totalCustomizations.reduce(
      (acc, b) => acc + (b.extras?.reduce((s, e) => s + e.preco, 0) || 0),
      0
    );
    addToCart(
      `${comboCustomization.item.nome}`,
      comboCustomization.basePrice + extrasTotal,
      { burgers: comboCustomization.totalCustomizations }
    );
    closeModal("popupCustom");
  }
}

// --- Carrinho ---
function addToCart(name, price, custom = {}) {
  if (sounds.add) sounds.add.play().catch(() => {});
  const customKey = JSON.stringify(custom);
  const existing = cart.findIndex(
    (c) => c.item === name.trim() && JSON.stringify(c.custom) === customKey
  );

  if (existing !== -1) cart[existing].quantity += 1;
  else cart.push({ item: name.trim(), price, quantity: 1, custom });

  updateCartDisplay();
}

function updateCartDisplay() {
  const sub = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const count = cart.reduce((acc, i) => acc + i.quantity, 0);

  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotalDisplay").textContent = `R$ ${sub.toFixed(
    2
  )}`;

  const itemsEl = document.getElementById("cartItems");
  if (itemsEl) {
    itemsEl.innerHTML = "";
    cart.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <div style="flex: 1;">
          <strong>${item.item}</strong><br>
          <small>${generateDetails(item.custom)}</small>
          <div style="color: var(--amarelo); font-weight: bold; margin-top: 5px;">R$ ${(
            item.price * item.quantity
          ).toFixed(2)}</div>
        </div>
        <div class="cart-controls">
          <button onclick="changeQuantity(${idx},-1)">-</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity(${idx},1)">+</button>
        </div>`;
      itemsEl.appendChild(div);
    });
  }
}

function generateDetails(c) {
  if (!c) return "";
  let p = [];
  if (c.removed?.length) p.push(`Sem: ${c.removed.join(", ")}`);
  if (c.extras?.length)
    p.push(`Adicional: ${c.extras.map((e) => e.nome).join(", ")}`);
  if (c.burgers) {
    c.burgers.forEach((b) => {
      let bDetails = `${b.burgerName}: `;
      if (b.extras.length)
        bDetails += `+${b.extras.map((e) => e.nome).join(", ")} `;
      if (b.removed.length) bDetails += `Sem ${b.removed.join(", ")}`;
      p.push(bDetails);
    });
  }
  return p.join(" | ");
}

function changeQuantity(idx, d) {
  cart[idx].quantity += d;
  if (cart[idx].quantity <= 0) cart.splice(idx, 1);
  updateCartDisplay();
}

// --- Finalização e WhatsApp ---
function enviarZap(e) {
  e.preventDefault();

  const nome = document.getElementById("inputNome").value;
  const pag = document.getElementById("selectPagamento").value;
  const endereco = document.getElementById("inputEndereco").value;
  const bairro = document.getElementById("selectBairro").value;
  const cupom = document.getElementById("inputCupom").value;

  // Validação de pagamento obrigatório (exceto Campo Grande em delivery)
  if (modoEntrega === "entrega" && bairro !== "Campo Grande" && !pag) {
    alert("Por favor, selecione a forma de pagamento.");
    return;
  }

  let msg = `*PEDIDO RIBBSZN*%0a*Cliente:* ${nome}%0a*Modo:* ${
    modoEntrega === "entrega" ? "Delivery" : "Retirada"
  }%0a`;

  if (modoEntrega === "entrega") {
    msg += `*Endereço:* ${endereco}%0a*Bairro:* ${bairro}%0a`;
    if (bairro === "Campo Grande") {
      msg += `%0a⚠️ *(DISTÂNCIA)* ⚠️%0a`;
    }
  }

  msg += `%0a*ITENS:*%0a`;
  cart.forEach((c) => {
    msg += `• ${c.quantity}x ${c.item}%0a`;
    let details = generateDetails(c.custom);
    if (details) msg += `  _${details}_%0a`;
  });

  const totalStr = document.getElementById("resumoTotal").textContent;
  const formaPagamentoTexto =
    modoEntrega === "entrega" && bairro === "Campo Grande"
      ? "A combinar no WhatsApp"
      : pag;

  msg += `%0a*Pagamento:* ${formaPagamentoTexto}%0a`;
  if (cupom) msg += `*Cupom:* ${cupom}%0a`;

  if (modoEntrega === "entrega" && bairro === "Campo Grande") {
    msg += `*Taxa:* A DEFINIR%0a*TOTAL (Pendente Taxa):* ${totalStr}`;
  } else {
    msg += `*Taxa:* R$ ${taxaEntregaAtual.toFixed(2)}%0a*TOTAL:* ${totalStr}`;
  }

  window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");
  finalizarPedido();
}

function finalizarPedido() {
  localStorage.removeItem("ribbs_cart");
  alert("Pedido enviado com sucesso!");
  location.reload();
}

// --- Helpers de UI ---
function openPopup(id) {
  document.getElementById("backdrop").classList.add("show");
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById("backdrop").classList.remove("show");
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

// --- Exposição para o HTML (window) ---
window.showCategory = showCategory;
window.toggleCart = () =>
  document.getElementById("footerCart").classList.toggle("open");
window.changeQuantity = changeQuantity;
window.iniciarCheckout = () => {
  if (cart.length) {
    document.getElementById("footerCart").classList.remove("open");
    openPopup("modalModoEntrega");
  }
};
window.selecionarModo = selecionarModo;
window.atualizarTaxaEntrega = atualizarTaxaEntrega;
window.gerenciarExibicaoPix = gerenciarExibicaoPix;
window.copiarChavePix = copiarChavePix;
window.verificarTroco = verificarTroco;
window.enviarZap = enviarZap;
window.closeModal = closeModal;
window.openPopupCustom = openPopupCustom;
window.selectCalda = (c) => {
  addToCart(`${pendingMilkShake.name} (Calda ${c})`, pendingMilkShake.price);
  closeModal("popupCalda");
};
window.openImagePopup = (src) => {
  document.getElementById("enlargedImage").src = src;
  openPopup("popupImage");
};
window.closeImagePopup = () => closeModal("popupImage");
window.closeCaldaPopup = () => closeModal("popupCalda");
window.clearCart = () => {
  if (confirm("Deseja limpar o carrinho?")) {
    cart = [];
    updateCartDisplay();
  }
};
