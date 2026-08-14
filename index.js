import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import P from 'pino'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'

console.log("=== BOT INICIANDO ===");

const API_URL = process.env.BACKEND_URL || "https://bot-clash-royale-backend.onrender.com"
const CLAN_TAG = (process.env.CLAN_TAG || "#GJCP9C8Y").replace('%23','#')
const PORT = process.env.PORT || 3000

console.log("API_URL:", API_URL);
console.log("CLAN_TAG:", CLAN_TAG);

let lastQR = null
let isConnected = false

// --- SERVIDOR WEB PARA MOSTRAR EL QR ---
const app = express()
app.get('/', async (req, res) => {
    if (isConnected) {
        return res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px">✅ BOT CONECTADO - PANCAKES VIP+</h1>')
    }
    if (!lastQR) {
        return res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px">⏳ Generando QR... refresca en 3 seg</h1><script>setTimeout(()=>location.reload(),3000)</script>')
    }
    const qrImage = await QRCode.toDataURL(lastQR, { width: 400, margin: 2 })
    res.send(`
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot QR</title></head>
    <body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:white">
        <h1>💎 PANCAKES VIP+ - Escanea QR</h1>
        <img src="${qrImage}" style="background:white;padding:20px;border-radius:20px;width:350px;height:350px"/>
        <p>Se actualiza solo cada 15s - Tienes 20s para escanear</p>
        <p>WhatsApp > Dispositivos vinculados > Vincular dispositivo</p>
        <script>setTimeout(()=>location.reload(),15000)</script>
    </body>
    </html>
    `)
})
app.get('/qr-image', async (req,res)=>{
    if(!lastQR) return res.status(404).send('No QR yet')
    const buffer = await QRCode.toBuffer(lastQR, { width: 600, margin: 1 })
    res.set('Content-Type','image/png')
    res.send(buffer)
})
app.listen(PORT, ()=> console.log(`🌐 Servidor QR en puerto ${PORT} - Abre tu link de Railway`))

async function startBot() {
    console.log("Cargando auth...");
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u
        if(qr){
            lastQR = qr
            console.log("=== NUEVO QR GENERADO - VE A TU LINK DE RAILWAY ===");
        }
        if(connection){
            console.log("Estado:", connection);
            if(connection === 'open'){ isConnected = true; lastQR = null }
            if(connection === 'close') isConnected = false
        }
        if (connection === 'close') {
            const should = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            console.log("Desconectado, reconectar?", should);
            if (should) startBot()
            else console.log("LOGOUT, borra la carpeta auth y vuelve a deployar");
        } else if (connection === 'open') console.log('💎 BOT VIP+ CONECTADO')
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim()
        const jid = msg.key.remoteId
        const lower = text.toLowerCase()

        let groupMeta = null
        try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
        const buscarJid = (nombre) => {
            if (!groupMeta) return null
            const m = groupMeta.participants.find(p => {
                const n = (p.notify || "").toLowerCase()
                return n.includes(nombre.toLowerCase().substring(0,4)) || nombre.toLowerCase().includes(n.substring(0,4))
            })
            return m? m.id : null
        }

        if (lower === "!menu") {
            let txt = `╭─━━━━━━━━━━━━━━━━━╮\n│ 💎 *PANCAKES VIP+* 💎 │\n│ 👑 *SISTEMA PREMIUM* 👑 │\n├─━━━━━━━━━━━━━━━━━┤\n│ ⚔️!guerra → Guerra completa\n│ 🚨!faltan → Solo faltan + tag\n│ 🏆!top → Top 10 PG\n│ 🏰!clan → Info VIP\n│ 👤!perfil #TAG → Perfil VIP\n│ 📦!cofres #TAG → Ciclo cofres\n│ 🃏!mazos #TAG → Mazos top\n│ 💤!inactivos → Inactivos\n╰─━━━━━━━━━━━━━━━━━╯`
            return sock.sendMessage(jid, { text: txt })
        }

        if (lower === "!ping") return sock.sendMessage(jid, { text: "💎 Pong! VIP+ activo ⚡" })

        if (lower === "!clan") {
            try {
                const { data } = await axios.get(`${API_URL}/clan/${CLAN_TAG.replace('#','')}`)
                let txt = `╭─ 💎 *CLAN VIP+* ─╮\n│ 🏰 *${data.name}*\n│ 🏷️ ${data.tag} | 👥 ${data.members}/50\n├──────────────────┤\n│ 🏆 Trofeos: ${data.clanScore}\n│ ⚔️ Guerra: ${data.warTrophies}\n╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ API dormida: " + API_URL }) }
        }

        if (lower === "!guerra" || lower === "!faltan" || lower === "!top") {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 15000 })
                const participantes = data.clan.participants.sort((a,b)=> b.fame - a.fame)
                const atacaron = participantes.filter(p => p.decksUsed === 4)
                const faltan = participantes.filter(p => p.decksUsed < 4)

                if (lower === "!faltan") {
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ GUERRA PERFECTA` })
                    let txt = `╭─ 🚨 *FALTAN ${faltan.length} - PANCAKES* ─╮\n`
                    let mentions = []
                    faltan.forEach(p=>{
                        const jidM = buscarJid(p.name)
                        if(jidM){ mentions.push(jidM); txt += `│ 💀 @${jidM.split('@')[0]} → ${p.decksUsed}/4 | PG:${p.fame}\n` }
                        else txt += `│ 💀 ${p.name} → ${p.decksUsed}/4 | PG:${p.fame}\n`
                    })
                    txt += `╰──────────────────────╯`
                    return sock.sendMessage(jid, { text: txt, mentions })
                }
                if (lower === "!top") {
                    let txt = `╭─ 🏆 *TOP PG VIP+* ─╮\n`
                    participantes.slice(0,10).forEach((p,i)=>{
                        const med = i===0?'🥇': i===1?'🥈': i===2?'🥉':`#${i+1}`
                        txt += `│ ${med} ${p.name} → ${p.fame} PG (${p.decksUsed}/4)\n`
                    })
                    txt += `╰──────────────────╯`
                    return sock.sendMessage(jid, { text: txt })
                }
                let mentions = []
                let faltanTxt = ""
                faltan.forEach(p=>{
                    const jidM = buscarJid(p.name)
                    if(jidM){ mentions.push(jidM); faltanTxt += `│ 💀 @${jidM.split('@')[0]} → ${p.decksUsed}/4 | PG:${p.fame}\n` }
                    else faltanTxt += `│ 💀 ${p.name} → ${p.decksUsed}/4 | PG:${p.fame}\n`
                })
                let txt = `╭─ ⚔️ *GUERRA PANCAKES❤️ 2.6* ─╮\n│ 🏷️ #GJCP9C8Y | 👥 ${participantes.length} | 🔥 Puntos de Guerra: ${data.clan.fame}\n├─ 📊 *RESUMEN* ─┤\n│ ✅ Atacaron: ${atacaron.length} | ❌ Faltan: ${faltan.length}\n├─ 🚨 *FALTAN (${faltan.length})* ─┤\n` + faltanTxt + `╰──────────────────────╯`
                return sock.sendMessage(jid, { text: txt, mentions })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Sin guerra activa" }) }
        }

        if (lower.startsWith("!perfil")) {
            const tag = text.split(" ")[1]
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/perfil/${cleanTag}`)
                let txt = `╭─ 💎 *PERFIL VIP+* ─╮\n│ 👤 *${data.name}*\n│ 🏷️ #${cleanTag}\n├─ 📊 *STATS* ─┤\n│ 🏆 ${data.trophies} | Max: ${data.bestTrophies}\n│ ⭐ Nivel: ${data.expLevel}\n╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Tag no encontrado" }) }
        }

        if (lower.startsWith("!cofres")) {
            const tag = text.split(" ")[1] || ""
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!cofres #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/cofres/${cleanTag}`)
                let txt = `╭─ 📦 *COFRES VIP+* ─╮\n`
                data.cofres.forEach((c,i)=>{ txt += `│ ${i===0?'👉': '▫️'} ${c}\n` })
                txt += `╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Error cofres" }) }
        }
    })
}
startBot()
