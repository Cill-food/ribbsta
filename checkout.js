/**
 * CHECKOUT.JS - RibbsZn
 * Validação e Cálculo de Frete por Distância Real
 */

const ORIGEM = "Rua Lauro de Souza, 465, Campo Grande, Recife - PE";

document.addEventListener("DOMContentLoaded", () => {
  const cart = JSON.parse(localStorage.getItem("ribbs_cart")) || [];
  const listaItens = document.getElementById("listaItens");
  const btnCalcular = document.getElementById("btnCalcular");
  const btnFinalizar = document.getElementById("btnFinalizar");

  let subtotal = 0;
  let taxaEntrega = 0;

  if (cart.length === 0) {
    alert("O seu carrinho está vazio!");
    window.location.href = "zap.html";
    return;
  }

  // 1. Renderizar Itens e Calcular Subtotal
  cart.forEach((item) => {
    subtotal += item.price * item.quantity;
    const div = document.createElement("div");
    div.className = "total-row";

    // Função para formatar detalhes de personalização (vinda do zap.js)
    let detalhesStr = "";
    if (item.custom) {
      if (typeof item.custom === "string") detalhesStr = item.custom;
      else if (item.custom.removed)
        detalhesStr = "Sem: " + item.custom.removed.join(", ");
    }

    div.innerHTML = `<span>${item.quantity}x ${
      item.item
    } <small>${detalhesStr}</small></span> 
                     <span>R$ ${(item.price * item.quantity).toFixed(
                       2
                     )}</span>`;
    listaItens.appendChild(div);
  });

  document.getElementById("subtotal").textContent = `R$ ${subtotal.toFixed(2)}`;
  atualizarTotal(subtotal, 0);

  // 2. Lógica de Cálculo de Taxa
  btnCalcular.addEventListener("click", () => {
    const rua = document.getElementById("rua").value;
    const bairro = document.getElementById("bairro").value;

    if (!rua || !bairro) {
      alert("Por favor, preencha a Rua e o Bairro para calcular o frete.");
      return;
    }

    const enderecoDestino = `${rua}, ${bairro}, Recife - PE`;
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [ORIGEM],
        destinations: [enderecoDestino],
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK") {
          const element = response.rows[0].elements[0];

          if (element.status === "OK") {
            const distanciaMetros = element.distance.value; // Distância em metros

            // --- VALIDAÇÃO DAS FAIXAS DE PREÇO ---
            if (distanciaMetros <= 200) {
              taxaEntrega = 1.0;
            } else if (distanciaMetros <= 300) {
              taxaEntrega = 2.0;
            } else if (distanciaMetros <= 500) {
              taxaEntrega = 3.0;
            } else if (distanciaMetros <= 1000) {
              taxaEntrega = 4.0;
            } else if (distanciaMetros <= 2000) {
              taxaEntrega = 5.0;
            } else if (distanciaMetros <= 5000) {
              taxaEntrega = 7.0;
            } else {
              alert("Endereço fora da nossa área de entrega (máximo 5km).");
              taxaEntrega = 0;
              btnFinalizar.disabled = true;
              btnFinalizar.style.opacity = "0.5";
              return;
            }

            // Atualiza Interface
            document.getElementById(
              "taxa"
            ).textContent = `R$ ${taxaEntrega.toFixed(2)}`;
            atualizarTotal(subtotal, taxaEntrega);

            // Ativa botão de finalizar
            btnFinalizar.disabled = false;
            btnFinalizar.style.opacity = "1";

            const distTexto =
              distanciaMetros >= 1000
                ? (distanciaMetros / 1000).toFixed(1) + "km"
                : distanciaMetros + "m";

            alert(
              `Distância: ${distTexto}\nTaxa de Entrega: R$ ${taxaEntrega.toFixed(
                2
              )}`
            );
          } else {
            alert(
              "Não conseguimos calcular a rota para este endereço. Verifique o número da casa."
            );
          }
        } else {
          alert("Erro na API do Google: " + status);
        }
      }
    );
  });

  function atualizarTotal(sub, taxa) {
    const total = sub + taxa;
    document.getElementById("total").textContent = `R$ ${total.toFixed(2)}`;
  }

  // 3. Enviar para o WhatsApp
  document.getElementById("formCheckout").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const rua = document.getElementById("rua").value;
    const bairro = document.getElementById("bairro").value;
    const ref = document.getElementById("referencia").value;
    const pag = document.getElementById("pagamento").value;
    const totalFinal = document.getElementById("total").textContent;

    let msg = `*NOVO PEDIDO - RIBBSZN*%0a%0a`;
    msg += `*Cliente:* ${nome}%0a`;
    msg += `*Endereço:* ${rua}, ${bairro}%0a`;
    if (ref) msg += `*Referência:* ${ref}%0a`;
    msg += `%0a*--- ITENS ---*%0a`;

    cart.forEach((c) => {
      msg += `• ${c.quantity}x ${c.item}%0a`;
    });

    msg += `%0a*Pagamento:* ${pag}%0a`;
    msg += `*Taxa de Entrega:* R$ ${taxaEntrega.toFixed(2)}%0a`;
    msg += `*TOTAL:* ${totalFinal}`;

    const whatsappNumber = "5581985299617";
    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");

    localStorage.removeItem("ribbs_cart");
    window.location.href = "zap.html";
  });
});
