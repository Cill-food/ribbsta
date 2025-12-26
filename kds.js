// kds.js - Sistema de Exibição de Cozinha (KDS) Atualizado
// ===============================================
// Versão: 2.6 (Adicionado Forma de Pagamento e Modo de Consumo Integrado)
// ===============================================

"use strict";

const newOrderSound = new Audio("beep.mp3");

class KDSManager {
  constructor() {
    this.ordersContainer = document.getElementById("ordersContainer");
    this.noOrdersMessage = document.getElementById("noOrdersMessage");
    this.historySidebar = document.getElementById("historySidebar");
    this.historyToggleBtn = document.getElementById("historyToggleBtn");
    this.historyContent = document.getElementById("historyContent");
    this.backdrop = document.getElementById("backdrop");
    this.historyTotalValue = document.getElementById("historyTotalValue");

    this.currentOrderId = null;

    this.init();
  }

  init() {
    // Escuta mudanças em outras abas (Totem enviando pedido)
    window.addEventListener("storage", (e) => {
      if (e.key === "kds_orders") {
        this.renderOrders();
        this.renderHistory();
        newOrderSound.play().catch(() => {});
      }
    });

    if (this.historyToggleBtn) {
      this.historyToggleBtn.onclick = () => this.toggleHistorySidebar();
    }

    this.renderOrders();
    this.renderHistory();
    this.setupEventListeners();
  }

  getOrders() {
    try {
      const orders = localStorage.getItem("kds_orders");
      return orders ? JSON.parse(orders) : [];
    } catch (e) {
      console.error("Erro ao ler pedidos:", e);
      return [];
    }
  }

  saveOrders(orders) {
    try {
      localStorage.setItem("kds_orders", JSON.stringify(orders));
      this.renderOrders();
      this.renderHistory();
    } catch (e) {
      console.error("Erro ao salvar pedidos:", e);
    }
  }

  renderOrders() {
    const orders = this.getOrders().filter((o) => o.status !== "Concluído");
    this.ordersContainer.innerHTML = "";

    if (orders.length === 0) {
      if (this.noOrdersMessage) this.noOrdersMessage.style.display = "block";
      return;
    }

    if (this.noOrdersMessage) this.noOrdersMessage.style.display = "none";

    // Ordenar: mais antigos primeiro (fila de produção)
    orders.sort((a, b) => a.dataHora.localeCompare(b.dataHora));

    orders.forEach((order) => {
      const card = document.createElement("div");
      card.className = `order-card ${order.status.toLowerCase()}`;

      // LÓGICA DO BADGE DE CONSUMO (LOCAL OU VIAGEM)
      const consumo = order.tipoConsumo || "Não Informado";
      const consumoClass =
        order.tipoConsumo === "Para Viagem" ? "badge-viagem" : "badge-local";

      // LÓGICA PARA FORMA DE PAGAMENTO
      const pagamentos = this.formatPayments(order.pagamentos);

      card.innerHTML = `
        <div class="order-header">
          <div>
            <strong>${order.nomeCliente}</strong>
            <span class="consumo-badge ${consumoClass}">${consumo}</span>
            <br><small>ID: ${order.id}</small>
          </div>
          <span class="order-time">${order.dataHora}</span>
        </div>
        <div class="order-items">
          ${order.itens
            .map(
              (item) => `
            <div class="order-item">
              <strong>${item.quantity}x</strong> ${item.item}
              <div class="item-details">${this.formatDetails(item.custom)}</div>
            </div>
          `
            )
            .join("")}
        </div>
        ${
          order.observacao
            ? `<div class="order-obs"><strong>OBS:</strong> ${order.observacao}</div>`
            : ""
        }
        <div class="order-payment">
          <strong>Pagamento:</strong> ${pagamentos}
        </div>
        <div class="order-footer">
          <button class="accept-btn" onclick="acceptOrder('${order.id}')">
            ${order.status === "Pendente" ? "ACEITAR" : "CONCLUIR"}
          </button>
          <button class="obs-btn" onclick="openObservationModal('${
            order.id
          }')">OBS</button>
          <button class="print-btn" onclick="printOrder('${
            order.id
          }')">🖨️</button>
          <button class="delete-btn" onclick="deleteOrder('${
            order.id
          }')">❌</button>
        </div>
      `;
      this.ordersContainer.appendChild(card);
    });
  }

  renderHistory(filter = "") {
    const orders = this.getOrders().filter((o) => o.status === "Concluído");
    if (!this.historyContent) return;
    this.historyContent.innerHTML = "";

    const filtered = orders.filter(
      (o) =>
        o.nomeCliente.toLowerCase().includes(filter.toLowerCase()) ||
        o.id.includes(filter)
    );

    let totalCaixa = 0;

    filtered.reverse().forEach((order) => {
      totalCaixa += order.total;
      const card = document.createElement("div");
      card.className = "history-item";

      const consumoClass =
        order.tipoConsumo === "Para Viagem" ? "badge-viagem" : "badge-local";

      // Adiciona forma de pagamento no histórico também
      const pagamentos = this.formatPayments(order.pagamentos);

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center">
          <strong>${order.nomeCliente}</strong>
          <span class="consumo-badge ${consumoClass}" style="font-size:10px">${
        order.tipoConsumo || ""
      }</span>
        </div>
        <small>${order.dataHora} - R$ ${order.total.toFixed(2)}</small>
        <small>Pagamento: ${pagamentos}</small>
        <div class="history-actions">
            <button onclick="toggleOrderStatus('${order.id}')">Reabrir</button>
            <button class="delete-btn" onclick="deleteOrder('${
              order.id
            }')">Excluir</button>
        </div>
      `;
      this.historyContent.appendChild(card);
    });

    if (this.historyTotalValue) {
      this.historyTotalValue.textContent = `R$ ${totalCaixa.toFixed(2)}`;
    }
  }

  formatPayments(pagamentos) {
    if (!pagamentos || pagamentos.length === 0) return "Não informado";
    return pagamentos
      .map((p) => `${p.method} (R$ ${p.value.toFixed(2)})`)
      .join(", ");
  }

  formatDetails(custom) {
    if (!custom) return "";
    let parts = [];

    if (custom.burgers && custom.burgers.length > 0) {
      custom.burgers.forEach((b) => {
        let bParts = [];
        if (b.removed && b.removed.length > 0)
          bParts.push(`SEM: ${b.removed.join(", ")}`);
        if (b.extras && b.extras.length > 0)
          bParts.push(`ADIC: ${b.extras.map((e) => e.nome).join(", ")}`);
        parts.push(`[${b.burgerName}: ${bParts.join(" | ") || "Padrão"}]`);
      });
      if (custom.comboExtras && custom.comboExtras.length > 0) {
        parts.push(
          `ADIC COMBO: ${custom.comboExtras.map((e) => e.nome).join(", ")}`
        );
      }
    } else {
      if (custom.calda) parts.push(`Calda: ${custom.calda}`);
      if (custom.removed && custom.removed.length > 0)
        parts.push(`SEM: ${custom.removed.join(", ")}`);
      if (custom.extras && custom.extras.length > 0)
        parts.push(`ADIC: ${custom.extras.map((e) => e.nome).join(", ")}`);
    }

    return parts.join("<br>");
  }

  acceptOrder(orderId) {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      if (order.status === "Pendente") {
        order.status = "Preparo";
      } else if (order.status === "Preparo") {
        order.status = "Concluído";
      }
      this.saveOrders(orders);
    }
  }

  toggleOrderStatus(orderId) {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "Preparo"; // Reabre para a cozinha
      this.saveOrders(orders);
    }
  }

  deleteOrder(orderId) {
    if (confirm("Excluir/Recusar este pedido?")) {
      const orders = this.getOrders().filter((o) => o.id !== orderId);
      this.saveOrders(orders);
    }
  }

  clearHistory() {
    if (confirm("Apagar TODO o histórico?")) {
      const orders = this.getOrders().filter((o) => o.status !== "Concluído");
      this.saveOrders(orders);
    }
  }

  toggleHistorySidebar() {
    this.historySidebar.classList.toggle("active");
  }

  openObservationModal(orderId) {
    this.currentOrderId = orderId;
    const order = this.getOrders().find((o) => o.id === orderId);
    if (!order) return;
    document.getElementById(
      "obsOrderInfo"
    ).textContent = `Pedido de: ${order.nomeCliente}`;
    document.getElementById("obsTextarea").value = order.observacao || "";
    document.getElementById("popupObservacao").style.display = "block";
    this.backdrop.style.display = "block";
  }

  closeModal(id) {
    document.getElementById(id).style.display = "none";
    this.backdrop.style.display = "none";
  }

  saveObservation() {
    const obs = document.getElementById("obsTextarea").value;
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === this.currentOrderId);
    if (order) {
      order.observacao = obs;
      this.saveOrders(orders);
    }
    this.closeModal("popupObservacao");
  }

  printOrder(orderId) {
    const order = this.getOrders().find((o) => o.id === orderId);
    if (!order) return;

    // Adiciona forma de pagamento na impressão
    const pagamentos = this.formatPayments(order.pagamentos);

    const win = window.open("", "PRINT", "height=600,width=400");
    win.document.write(`
      <html>
        <head><title>Imprimir Pedido</title></head>
        <body style="font-family: monospace; width: 280px; padding: 10px;">
          <center>
            <h2 style="margin:0">RIBBS ZN</h2>
            <p style="margin:5px 0">** ${order.tipoConsumo || "LOCAL"} **</p>
            <hr>
          </center>
          <p>Cliente: ${order.nomeCliente}</p>
          <p>Hora: ${order.dataHora}</p>
          <p>Pagamento: ${pagamentos}</p>
          <hr>
          ${order.itens
            .map(
              (i) => `
            <div style="margin-bottom:8px">
              <b>${i.quantity}x ${i.item}</b><br>
              <small>${this.formatDetails(i.custom).replace(
                /<br>/g,
                ", "
              )}</small>
            </div>
          `
            )
            .join("")}
          <hr>
          ${order.observacao ? `<p>OBS: ${order.observacao}</p><hr>` : ""}
          <center><p>#Pedeoteu</p></center>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
    win.close();
  }

  setupEventListeners() {
    const saveObsBtn = document.querySelector("#popupObservacao .accept-btn");
    if (saveObsBtn) {
      saveObsBtn.onclick = () => this.saveObservation();
    }
  }
}

const kdsManager = new KDSManager();

// Funções globais para botões inline
window.acceptOrder = (id) => kdsManager.acceptOrder(id);
window.openObservationModal = (id) => kdsManager.openObservationModal(id);
window.printOrder = (id) => kdsManager.printOrder(id);
window.toggleOrderStatus = (id) => kdsManager.toggleOrderStatus(id);
window.deleteOrder = (id) => kdsManager.deleteOrder(id);
window.toggleHistorySidebar = () => kdsManager.toggleHistorySidebar();
window.closeModal = (id) => kdsManager.closeModal(id);
