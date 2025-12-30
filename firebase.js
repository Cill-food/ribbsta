// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC17sn46E9V7L_LNXeVJ_XoIrtk3RS7Q2w",
  authDomain: "ribbsznpedidos.firebaseapp.com",
  databaseURL: "https://ribbsznpedidos-default-rtdb.firebaseio.com",
  projectId: "ribbsznpedidos",
  storageBucket: "ribbsznpedidos.firebasestorage.app",
  messagingSenderId: "326533913492",
  appId: "1:326533913492:web:7a9e5eb192c0a43fa3cd81",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Função que envia pedido para o Firebase (KDS)
export function enviarPedidoParaFirebase(pedido) {
  const pedidosRef = ref(db, "pedidos");
  return push(pedidosRef, pedido);
}
