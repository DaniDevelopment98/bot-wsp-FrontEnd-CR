import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import P from 'pino'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'

console.log("=== BOT INICIANDO V2 PRO ===");

const API_URL = process.env.BACKEND_URL || "https://bot-clash-royale-backend.onrender.com"
const CLAN_TAG = (process.env.CLAN_TAG || "#GJCP9C8Y").replace('%23','#')
const PORT = process.env.PORT || 3000

let lastQR = null
let isConnected = false

const app = express()
app.get('/', async (req, res) => {
    if (isConnected) return res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px">✅ BOT CONECTADO - PANCAKES VIP+ V2 PRO</h1>')
    if (!lastQR) return res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px">⏳ Generando QR... refresca en 3 seg</h1><script>setTimeout(()=>location.reload(),3000)</script>')
    const qrImage = await QRCode.toDataURL(lastQR, { width: 400, margin: 2 })
    res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot QR</title></head><body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:white"><h1>💎 PANCAKES VIP+ V2 - Escanea QR</h1><img src="${qrImage}" style="background:white;padding:20px;border-radius:20px;width:350px;height:350px"/><p>Se actualiza solo cada 15s</p><script>setTimeout(()=>location.reload(),15000)</script></body></html>`)
})
app.listen(PORT, ()=> console.log(`🌐 QR en puerto ${PORT}`))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }) })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u
        if(qr){ lastQR = qr; console.log("=== NUEVO QR ==="); }
        if(connection){ if(connection === 'open'){ isConnected = true; lastQR = null } if(connection === 'close') isConnected = false }
        if (connection === 'close') {
            const should = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (should) startBot()
        } else if (connection === 'open') console.log('💎 BOT V2 PRO CONECTADO')
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim()
        const jid = msg.key.remoteJid
        const lower = text.toLowerCase()

               let groupMeta = null
        try { 
            if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) 
        } catch(e){}

        const buscarJid = (nombre) => {
            if (!groupMeta) return null
            const m = groupMeta.participants.find(p => {
                const n = (p.notify || p.name || "").toLowerCase()
                return n.includes(nombre.toLowerCase().substring(0,4)) || nombre.toLowerCase().includes(n.substring(0,4))
            })
            return m ? m.id : null
        }
        if (lower === "!menu") {
            let txt = `╭─━━━━━━━━━━━━━━━━━━━━╮\n│ 💎 *PANCAKES VIP+ V2 PRO* 💎 │\n├─━━━━━━━━━━━━━━━━━━━━┤\n│ ⚔️ *!guerra* → Reporte ejecutivo\n│ 🚨 *!faltan* → Solo faltan + tag\n│ 🏆 *!top* → Top 10 PG\n│ 🏰 *!clan* → Info clan\n│ 👤 *!perfil #TAG* → Perfil PRO\n│ 📦 *!cofres #TAG* → Ciclo\n│ 💎 *!ping* → Test\n╰─━━━━━━━━━━━━━━━━━━━━╯`
            return sock.sendMessage(jid, { text: txt })
        }
        if (lower === "!ping") return sock.sendMessage(jid, { text: "💎 Pong! V2 PRO activo ⚡🚀" })

        if (lower === "!clan") {
            try {
                const { data } = await axios.get(`${API_URL}/clan/${CLAN_TAG.replace('#','')}`)
                let txt = `╭─ 💎 *CLAN PRO* ─╮\n│ 🏰 *${data.name}*\n│ 🏷️ ${data.tag} | 👥 ${data.members}/50\n│ 🏆 Trofeos: ${data.clanScore}\n│ ⚔️ Guerra: ${data.warTrophies}\n│ 📍 Ubicación: ${data.location?.name || 'Int.'}\n╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ API dormida" }) }
        }

        // --- GUERRA V2 PRO ---
        if (lower === "!guerra" || lower === "!faltan" || lower === "!top") {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 20000 })
                const participantes = data.clan.participants.sort((a,b)=> b.fame - a.fame)
                const atacaron = participantes.filter(p => p.decksUsed === 4)
                const faltan = participantes.filter(p => p.decksUsed < 4)
                const totalDecks = participantes.length * 4
                const decksUsados = participantes.reduce((a,b)=> a + b.decksUsed, 0)
                const porcentaje = Math.round((decksUsados/totalDecks)*100)
                const avgFame = Math.round(participantes.reduce((a,b)=> a + b.fame,0)/participantes.length)
                const barra = "█".repeat(Math.floor(porcentaje/10)) + "░".repeat(10-Math.floor(porcentaje/10))

                if (lower === "!faltan") {
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ *GUERRA PERFECTA* - Todos atacaron! 🏆🔥\n${barra} ${porcentaje}%` })
                    let txt = `╭─ 🚨 *FALTAN ${faltan.length} - URGENTE* ─╮\n│ ${barra} ${porcentaje}% | ${decksUsados}/${totalDecks} ataques\n├──────────────────────┤\n`
                    let mentions = []
                    faltan.forEach(p=>{
                        const jidM = buscarJid(p.name)
                        const progreso = "🟢".repeat(p.decksUsed) + "⚫".repeat(4-p.decksUsed)
                        if(jidM){ mentions.push(jidM); txt += `│ ${progreso} @${jidM.split('@')[0]} → ${p.decksUsed}/4 | ${p.fame} PG\n` }
                        else txt += `│ ${progreso} ${p.name} → ${p.decksUsed}/4 | ${p.fame} PG\n`
                    })
                    txt += `╰──────────────────────╯`
                    return sock.sendMessage(jid, { text: txt, mentions: mentions.filter(m=>m.includes('@s.whatsapp.net')) })
                }
                if (lower === "!top") {
                    let txt = `╭─ 🏆 *TOP 10 PG - PANCAKES* ─╮\n│ 🔥 Total: ${data.clan.fame} PG | Prom: ${avgFame}\n├──────────────────────┤\n`
                    participantes.slice(0,10).forEach((p,i)=>{
                        const med = i===0?'🥇': i===1?'🥈': i===2?'🥉':`#${i+1}`
                        txt += `│ ${med} ${p.name} → *${p.fame} PG* (${p.decksUsed}/4)\n`
                    })
                    txt += `╰──────────────────────╯`
                    return sock.sendMessage(jid, { text: txt })
                }
                //!guerra completo PRO
                let mentions = []
                let faltanTxt = ""
                faltan.sort((a,b)=> a.decksUsed - b.decksUsed).forEach(p=>{
                    const jidM = buscarJid(p.name)
                    const progreso = "🟢".repeat(p.decksUsed) + "🔴".repeat(4-p.decksUsed)
                    if(jidM){ mentions.push(jidM); faltanTxt += `│ ${progreso} @${jidM.split('@')[0]} → ${p.decksUsed}/4 | ${p.fame} PG\n` }
                    else faltanTxt += `│ ${progreso} ${p.name} → ${p.decksUsed}/4 | ${p.fame} PG\n`
                })
                const top5 = participantes.slice(0,5).map((p,i)=> `│ ${i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`} *${p.name}* → ${p.fame} PG\n`).join('')

                let txt = `╭─ ⚔️ *REPORTE GUERRA PRO - PANCAKES* ─╮\n`
                txt += `│ 🏷️ #GJCP9C8Y | 👥 ${participantes.length} miembros\n`
                txt += `│ 🔥 *${data.clan.fame} PG* | 📊 Prom: ${avgFame} PG\n`
                txt += `│ ${barra} *${porcentaje}%* (${decksUsados}/${totalDecks})\n`
                txt += `├─ 📊 *RESUMEN* ─┤\n`
                txt += `│ ✅ Completaron: ${atacaron.length} | ❌ Faltan: ${faltan.length}\n`
                txt += `├─ 🏆 *TOP 5 MVP* ─┤\n${top5}`
                txt += `├─ 🚨 *FALTAN (${faltan.length})* ─┤\n${faltanTxt || '│ ✅ Nadie, guerra perfecta!\n'}`
                txt += `╰─ 💎 *PANCAKES VIP+ V2* ─╯`
                return sock.sendMessage(jid, { text: txt, mentions: mentions.filter(m=>m.includes('@s.whatsapp.net')) })
            } catch(e){ console.log(e); return sock.sendMessage(jid, { text: "❌ Sin guerra activa o API caida" }) }
        }

        // --- PERFIL V2 PRO - NIVEL 1000 ---
        if (lower.startsWith("!perfil")) {
            const tag = text.split(" ")[1]
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG\nEj:!perfil #2PP" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/perfil/${cleanTag}`)

                const favCard = data.currentFavouriteCard?.name || 'N/A'
                const currentDeck = data.currentDeck?.map(c=> c.name).join(', ') || 'Privado'
                const clanName = data.clan? `${data.clan.name} [${data.role || 'Miembro'}]` : 'Sin clan'
                const arena = data.arena?.name || 'Desconocida'
                const winRate = data.battleCount? Math.round((data.wins / data.battleCount)*100) : 0

                let txt = `╭─ 💎 *PERFIL PRO - NIVEL 1000* ─╮\n`
                txt += `│ 👤 *${data.name}* | #${cleanTag}\n`
                txt += `│ 🏰 ${clanName}\n`
                txt += `├─ 🏆 *TROFEOS* ─┤\n`
                txt += `│ 🏆 Actual: *${data.trophies}*\n`
                txt += `│ 🔝 Récord: ${data.bestTrophies}\n`
                txt += `│ 🗺️ Arena: ${arena}\n`
                txt += `│ ⭐ Nivel: ${data.expLevel} | Exp: ${data.expPoints || 0}\n`
                txt += `├─ ⚔️ *BATALLAS* ─┤\n`
                txt += `│ ⚔️ Peleas: ${data.battleCount || 0} | ✅ ${data.wins || 0} | ❌ ${data.losses || 0}\n`
                txt += `│ 📊 WinRate: ${winRate}% | 👑 3 Coronas: ${data.threeCrownWins || 0}\n`
                txt += `│ 🏅 War Day Wins: ${data.warDayWins || 0} | 🌟 StarPoints: ${data.starPoints || 0}\n`
                txt += `├─ 🎴 *CARTAS* ─┤\n`
                txt += `│ ❤️ Fav: ${favCard}\n`
                txt += `│ 🎴 Mazo: ${currentDeck.substring(0,80)}${currentDeck.length>80?'...':''}\n`
                txt += `│ 🎁 Donadas: ${data.totalDonations || data.donations || 0}\n`
                txt += `├─ 🏅 *DESAFÍOS* ─┤\n`
                txt += `│ 🏆 Max Desafío: ${data.challengeMaxWins || 0} | Cartas Ganadas: ${data.challengeCardsWon || 0}\n`
                txt += `│ 🎪 Torneo: ${data.tournamentCardsWon || 0} | Batalla Torneo: ${data.tournamentBattleCount || 0}\n`
                txt += `╰─ 💎 *PANCAKES VIP+* ─╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ console.log(e.message); return sock.sendMessage(jid, { text: "❌ Tag no encontrado o API caida" }) }
        }

        if (lower.startsWith("!cofres")) {
            const tag = text.split(" ")[1] || ""
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!cofres #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/cofres/${cleanTag}`)
                let txt = `╭─ 📦 *COFRES PRO* ─╮\n`
                data.cofres?.forEach((c,i)=>{ txt += `│ ${i===0?'👉': '▫️'} ${c}\n` })
                txt += `╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Error cofres" }) }
        }
    })
}
startBot()
