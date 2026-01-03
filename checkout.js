/**
 * CHECKOUT.JS - RibbsZn
 * Cálculo de Frete por Faixas de Distância
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

  // Renderizar Itens
  cart.forEach((item) => {
    subtotal += item.price * item.quantity;
    const div = document.createElement("div");
    div.className = "total-row";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.marginBottom = "8px";

    let detalhes = item.custom ? ` <small>(${item.custom})</small>` : "";
    div.innerHTML = `<span>${item.quantity}x ${item.item}${detalhes}</span> 
                         <span>R$ ${(item.price * item.quantity).toFixed(
                           2
                         )}</span>`;
    listaItens.appendChild(div);
  });

  atualizarTotais();

  function atualizarTotais() {
    document.getElementById("subtotal").textContent = `R$ ${subtotal.toFixed(
      2
    )}`;
    if (taxaEntrega > 0) {
      document.getElementById("taxa").textContent = `R$ ${taxaEntrega.toFixed(
        2
      )}`;
      document.getElementById("total").textContent = `R$ ${(
        subtotal + taxaEntrega
      ).toFixed(2)}`;
    } else {
      document.getElementById("taxa").textContent = "A calcular...";
      document.getElementById("total").textContent = `R$ ${subtotal.toFixed(
        2
      )}`;
    }
  }

  // Função para definir o valor com base na sua tabela
  function calcularPrecoPorDistancia(metros) {
    if (metros <= 200) return 1.0; // Até 100m e 200m
    if (metros <= 300) return 2.0;
    if (metros <= 500) return 3.0;
    if (metros <= 1000) return 4.0; // Até 1km
    if (metros <= 2000) return 5.0; // Até 2km

    // Regra para distâncias maiores que 2km (Ex: R$ 2,00 por km adicional)
    const kmExtra = Math.ceil((metros - 2000) / 1000);
    return 5.0 + kmExtra * 2.0;
  }

  // Cálculo via Google Maps
  btnCalcular.addEventListener("click", () => {
    const rua = document.getElementById("rua").value;
    const bairro = document.getElementById("bairro").value;

    if (!rua || !bairro) {
      alert("Preencha o endereço completo primeiro.");
      return;
    }

    const destino = `${rua}, ${bairro}, Pernambuco, Brasil`;
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [ORIGEM],
        destinations: [destino],
        travelMode: "DRIVING",
      },
      (response, status) => {
        if (status === "OK") {
          const results = response.rows[0].elements[0];

          if (results.status === "OK") {
            const distanciaMetros = results.distance.value; // Distância em metros
            taxaEntrega = calcularPrecoPorDistancia(distanciaMetros);

            atualizarTotais();

            btnFinalizar.disabled = false;
            btnFinalizar.style.opacity = "1";

            const distTexto =
              distanciaMetros >= 1000
                ? (distanciaMetros / 1000).toFixed(1) + "km"
                : distanciaMetros + " metros";

            alert(
              `Endereço localizado!\nDistância: ${distTexto}\nTaxa de Entrega: R$ ${taxaEntrega.toFixed(
                2
              )}`
            );
          } else {
            alert("Endereço não localizado. Tente incluir o número da casa.");
          }
        } else {
          alert("Erro na API: " + status);
        }
      }
    );
  });

  // Enviar WhatsApp
  document.getElementById("formCheckout").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const rua = document.getElementById("rua").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    const totalFinal = document.getElementById("total").textContent;

    let msg = `*NOVO PEDIDO - RIBBSZN*%0a%0a`;
    msg += `*Cliente:* ${nome}%0a`;
    msg += `*Endereço:* ${rua}, ${bairro}%0a`;
    msg += `%0a*--- ITENS ---*%0a`;

    cart.forEach((c) => {
      msg += `• ${c.quantity}x ${c.item}%0a`;
    });

    msg += `%0a*Pagamento:* ${pag}%0a`;
    msg += `*TOTAL:* ${totalFinal}`;

    window.open(`https://wa.me/5581985299617?text=${msg}`, "_blank");
    localStorage.removeItem("ribbs_cart");
    window.location.href = "zap.html";
  });
});
