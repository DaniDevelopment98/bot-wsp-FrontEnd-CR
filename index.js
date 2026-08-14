import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import dotenv from "dotenv"
import axios from "axios"

console.log("Iniciando...")
fetch("https://api.ipify.org?format=json").then(r=>r.json()).then(d=>console.log("MI IP DE RENDER ES:", d.ip))

dotenv.config()

const CLASH_API_KEY = process.env.CLASH_API_KEY
const CLASH_TAG = process.env.CLASH_TAG

async function getClanInfo() {
    try {
        const tag = encodeURIComponent(CLASH_TAG)
        const res = await axios.get(`https://api.clashofclans.com/v1/clans/${tag}`, {
            headers: { Authorization: `Bearer ${CLASH_API_KEY}` }
        })
        const clan = res.data
        return `🏰 *${clan.name}* ${clan.tag}\n` +
               `Nivel: ${clan.clanLevel} | Puntos: ${clan.clanPoints}\n` +
               `Miembros: ${clan.members}/50\n` +
               `Descripción: ${clan.description}\n\n` +
               `Miembros:\n` + clan.memberList.map(m => `- ${m.name} | TH${m.townHallLevel}`).join("\n")
    } catch (e) {
        console.log(e.response?.data || e.message)
        return "Error al consultar la API de CoC. Revisa TAG y API_KEY"
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")
    
    const sock = makeWASocket({
        auth: state,
        browser: ["Bot CoC", "Chrome", "1.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.log("\nESCANEA ESTE QR - Abre este link en tu cel:\n")
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`)
            console.log("\nO escanea abajo:\n")
            qrcode.generate(qr, { small: true })
        }
        if (connection === "open") {
            console.log("✅ Bot conectado!")
        }
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut
            console.log("Desconectado, motivo:", lastDisconnect?.error)
            if (shouldReconnect) {
                console.log("Reconectando en 5 seg...")
                setTimeout(startBot, 5000)
            } else {
                console.log("Sesión cerrada, borra la carpeta auth para nuevo QR")
            }
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue
            if (msg.key.fromMe) continue
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
            const jid = msg.key.remoteJid

            if (text.toLowerCase().startsWith("!clan")) {
                await sock.sendMessage(jid, { text: "Consultando clan..." })
                const info = await getClanInfo()
                await sock.sendMessage(jid, { text: info })
            }
            if (text.toLowerCase() === "!ping") {
                await sock.sendMessage(jid, { text: "Pong! ✅ Bot activo" })
            }
        }
    })
}

startBot()