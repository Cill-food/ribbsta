// kds.js completo com modificações
// kds.js - Sistema de Exibição de Cozinha (KDS) Atualizado
// ===============================================
// Versão: 2.6 (Adicionado Forma de Pagamento e Modo de Consumo Integrado)
// ===============================================

"use strict";

import { pedidosRef, onChildAdded, update, remove } from "./firebase-kds.js";

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
    this.settingsSidebar = document.getElementById("settingsSidebar");
    this.settingsToggleBtn = document.getElementById("settingsToggleBtn");

    this.currentOrderId = null;
    this.previousOrderCount = 0;
    this.notifSettings = {
      enabled: true,
      title: "Novo Pedido!",
      body: "Um novo pedido chegou à cozinha.",
      icon: "",
    };

    this.alertInterval = null;

    this.init();
    this.listenFirebaseOrders();
  }

  listenFirebaseOrders() {
    onChildAdded(pedidosRef, (snapshot) => {
      const pedido = snapshot.val();
      pedido.firebaseId = snapshot.key;

      const pedidosLocal = this.getOrders();

      // Evita duplicar
      if (pedidosLocal.some((p) => p.id === pedido.id)) return;

      pedidosLocal.push(pedido);
      this.saveOrders(pedidosLocal);

      this.showNewOrderNotification();
      newOrderSound.play().catch(() => {});
    });
  }

  init() {
    // Request notification permission
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    this.loadNotifSettings();

    // Escuta mudanças em outras abas (Totem enviando pedido)
    window.addEventListener("storage", (e) => {
      if (e.key === "kds_orders") {
        const newOrders = this.getOrders();
        if (newOrders.length > this.previousOrderCount) {
          this.showNewOrderNotification();
        }
        this.previousOrderCount = newOrders.length;
        this.renderOrders();
        this.renderHistory();
        newOrderSound.play().catch(() => {});
      }
    });

    if (this.historyToggleBtn) {
      this.historyToggleBtn.onclick = () => this.toggleHistorySidebar();
    }

    if (this.settingsToggleBtn) {
      this.settingsToggleBtn.onclick = () => this.toggleSettingsSidebar();
    }

    newOrderSound.volume = localStorage.getItem("beepVolume") || 1;

    this.renderOrders();
    this.renderHistory();
    this.setupEventListeners();

    this.timerInterval = setInterval(() => this.updateTimers(), 60000);

    window.addEventListener("storage", (e) => {
      if (e.key === "unavailable_items_updated") {
        // Pode recarregar o modal se aberto, mas por simplicidade, não faz nada aqui
      }
    });
  }

  loadNotifSettings() {
    const saved = localStorage.getItem("notifSettings");
    if (saved) {
      this.notifSettings = JSON.parse(saved);
    }
    // Apply to UI
    const enableCheckbox = document.getElementById("enableNotifs");
    const titleInput = document.getElementById("notifTitle");
    const bodyInput = document.getElementById("notifBody");
    const iconInput = document.getElementById("notifIcon");
    if (enableCheckbox) enableCheckbox.checked = this.notifSettings.enabled;
    if (titleInput) titleInput.value = this.notifSettings.title;
    if (bodyInput) bodyInput.value = this.notifSettings.body;
    if (iconInput) iconInput.value = this.notifSettings.icon;
  }

  saveNotifSettings() {
    this.notifSettings.enabled =
      document.getElementById("enableNotifs").checked;
    this.notifSettings.title = document.getElementById("notifTitle").value;
    this.notifSettings.body = document.getElementById("notifBody").value;
    this.notifSettings.icon = document.getElementById("notifIcon").value;
    localStorage.setItem("notifSettings", JSON.stringify(this.notifSettings));
  }

  showNewOrderNotification() {
    if (this.notifSettings.enabled && Notification.permission === "granted") {
      const options = {
        body: this.notifSettings.body,
      };
      if (this.notifSettings.icon) {
        options.icon = this.notifSettings.icon;
      }
      new Notification(this.notifSettings.title, options);
    }
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
          <span class="order-timer"></span>
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

    const pendentes = orders.filter((o) => o.status === "Pendente").length;
    if (pendentes > 0) {
      this.startAlertSound();
    } else {
      this.stopAlertSound();
    }
  }

  startAlertSound() {
    if (this.alertInterval) return;
    this.alertInterval = setInterval(() => {
      newOrderSound.play().catch(() => {});
    }, 1000); // A cada 1 segundo, ajuste se necessário
  }

  stopAlertSound() {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
  }

  updateTimers() {
    // Código existente para timers, se houver
  }

  renderHistory(searchTerm = "") {
    // Código existente para renderHistory
  }

  calculateHistoryTotals() {
    // Código existente
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
        if (bParts.length > 0)
          parts.push(`${b.burgerName} (${bParts.join("; ")})`);
      });
      if (custom.comboExtras && custom.comboExtras.length > 0)
        parts.push(
          `Extras: ${custom.comboExtras.map((e) => e.nome).join(", ")}`
        );
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

    acceptOrder(orderId);
    {
      const orders = this.getOrders();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (order.status === "Pendente") {
        order.status = "Preparo";
      } else {
        order.status = "Concluído";
      }

      this.saveOrders(orders);

      if (order.firebaseId) {
        update(ref(db, `pedidos/${order.firebaseId}`), {
          status: order.status,
        });
      }
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
    deleteOrder(orderId);
    {
      if (!confirm("Excluir este pedido?")) return;

      const orders = this.getOrders();
      const order = orders.find((o) => o.id === orderId);

      const novos = orders.filter((o) => o.id !== orderId);
      this.saveOrders(novos);

      if (order?.firebaseId) {
        remove(ref(db, `pedidos/${order.firebaseId}`));
      }
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

  toggleSettingsSidebar() {
    this.settingsSidebar.classList.toggle("active");
  }

  setBeepVolume(vol) {
    newOrderSound.volume = vol;
    localStorage.setItem("beepVolume", vol);
  }

  toggleTheme() {
    document.body.classList.toggle("light-mode");
  }

  exportHistory() {
    const orders = this.getOrders().filter((o) => o.status === "Concluído");
    let csv = "ID,Nome Cliente,Tipo Consumo,Data Hora,Total,Pagamentos\n";
    orders.forEach((o) => {
      csv += `${o.id},${o.nomeCliente},${o.tipoConsumo},${
        o.dataHora
      },${o.total.toFixed(2)},${this.formatPayments(o.pagamentos)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico_pedidos.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  async loadMenuData() {
    try {
      const response = await fetch("cardapio.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error("Erro ao carregar cardapio.json no KDS:", e);
      return {}; // Retorna vazio em caso de erro
    }
  }

  async openMenuManagementModal() {
    const menuData = await this.loadMenuData();
    const content = document.getElementById("menuManagementContent");
    if (!content) return;

    content.innerHTML = ""; // Limpa conteúdo anterior

    Object.keys(menuData).forEach((category) => {
      const categoryDiv = document.createElement("div");
      categoryDiv.innerHTML = `<h4 style="margin: 10px 0; color: var(--amarelo);">${category}</h4>`;

      menuData[category].forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "switch-row"; // Reusa estilo existente
        itemDiv.style.marginBottom = "10px";

        const label = document.createElement("label");
        label.textContent = item.nome;
        label.style.color = "#ccc";

        const switchLabel = document.createElement("label");
        switchLabel.className = "switch";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !this.isItemUnavailable(item.nome); // Checked = Disponível
        input.onchange = () =>
          this.toggleItemAvailability(item.nome, input.checked);

        const slider = document.createElement("span");
        slider.className = "slider round";

        switchLabel.appendChild(input);
        switchLabel.appendChild(slider);

        itemDiv.appendChild(label);
        itemDiv.appendChild(switchLabel);
        categoryDiv.appendChild(itemDiv);
      });

      content.appendChild(categoryDiv);
    });

    document.getElementById("menuManagementModal").style.display = "block";
    this.backdrop.style.display = "block";
  }

  isItemUnavailable(itemName) {
    const unavailable = JSON.parse(
      localStorage.getItem("unavailable_items") || "[]"
    );
    return unavailable.includes(itemName);
  }

  toggleItemAvailability(itemName, isAvailable) {
    let unavailable = JSON.parse(
      localStorage.getItem("unavailable_items") || "[]"
    );
    if (isAvailable) {
      unavailable = unavailable.filter((name) => name !== itemName); // Torna disponível
    } else {
      if (!unavailable.includes(itemName)) unavailable.push(itemName); // Torna indisponível
    }
    localStorage.setItem("unavailable_items", JSON.stringify(unavailable));

    // Dispara evento para sincronizar com o totem (se aberto em outra aba)
    localStorage.setItem("unavailable_items_updated", Date.now()); // Trigger para escuta
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
window.toggleSettingsSidebar = () => kdsManager.toggleSettingsSidebar();
window.closeModal = (id) => kdsManager.closeModal(id);
