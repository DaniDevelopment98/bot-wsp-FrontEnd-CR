import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import dotenv from "dotenv"
import axios from "axios"

dotenv.config()
console.log("Iniciando bot CoC...")

const CLASH_API_KEY = process.env.CLASH_API_KEY
const CLASH_TAG = process.env.CLASH_TAG

if (!CLASH_API_KEY || !CLASH_TAG) {
    console.log("❌ FALTA CLASH_API_KEY o CLASH_TAG en el .env")
}

async function getClanInfo() {
    try {
        const tag = encodeURIComponent(CLASH_TAG)
        const res = await axios.get(`https://api.clashofclans.com/v1/clans/${tag}`, {
            headers: { Authorization: `Bearer ${CLASH_API_KEY}` }
        })
        const clan = res.data
        return `🏰 *${clan.name}* ${clan.tag}\n` +
               `Nivel: ${clan.clanLevel} | Puntos: ${clan.clanPoints} | VS: ${clan.clanVersusPoints}\n` +
               `Miembros: ${clan.members}/50\n` +
               `Descripción: ${clan.description}\n\n` +
               `Miembros:\n` + clan.memberList.map(m => `- ${m.name} | TH${m.townHallLevel} | ${m.role}`).join("\n")
    } catch (e) {
        console.log(e.response?.data || e.message)
        return "❌ Error al consultar la API de CoC. Revisa que tu IP esté autorizada en developer.clashofclans.com y el TAG."
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
            console.log("\nESCANEA ESTE QR:\n")
            qrcode.generate(qr, { small: true })
        }
        if (connection === "open") {
            console.log("✅ Bot conectado!")
        }
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut
            console.log("Desconectado:", lastDisconnect?.error?.message)
            if (shouldReconnect) {
                setTimeout(startBot, 5000)
            } else {
                console.log("Sesión cerrada, borra la carpeta /auth")
            }
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue
            if (msg.key.fromMe) continue
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim()
            const jid = msg.key.remoteJid
            const lower = text.toLowerCase()

            if (lower === "!menu" || lower === "!help" || lower === "!ayuda") {
                await sock.sendMessage(jid, { text: 
`📋 *MENU BOT COC*

!ping - Ver si el bot está activo
!clan - Info del clan
!top - Top 5 del clan por trofeos

Hecho con Baileys + CoC API 🏰` })
            }
            if (lower === "!ping") {
                await sock.sendMessage(jid, { text: "Pong! ✅ Bot activo" })
            }
            if (lower.startsWith("!clan")) {
                await sock.sendMessage(jid, { text: "Consultando clan..." })
                const info = await getClanInfo()
                await sock.sendMessage(jid, { text: info })
            }
            if (lower === "!top") {
                try {
                    const tag = encodeURIComponent(CLASH_TAG)
                    const res = await axios.get(`https://api.clashofclans.com/v1/clans/${tag}`, {
                        headers: { Authorization: `Bearer ${CLASH_API_KEY}` }
                    })
                    const top = res.data.memberList.sort((a,b) => b.trophies - a.trophies).slice(0,5)
                    const txt = "🏆 *TOP 5*\n" + top.map((m,i) => `${i+1}. ${m.name} - ${m.trophies} copas`).join("\n")
                    await sock.sendMessage(jid, { text: txt })
                } catch(e) {
                    await sock.sendMessage(jid, { text: "Error al obtener top" })
                }
            }
        }
    })
}

startBot()