const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const axios = require('axios')

const API_URL = "https://bot-clash-royale-backend.onrender.com"
const CLAN_TAG = "%23GJCP9C8Y"

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), printQRInTerminal: true })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'close') {
            const should = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (should) startBot()
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

        if (lower === "!menu" || lower === "!help") {
            let txt = `╭─━━━━━━━━━━━━━━━━━╮\n`
            txt += `│ 💎 *PANCAKES VIP+* 💎 │\n`
            txt += `│ 👑 *SISTEMA PREMIUM* 👑 │\n`
            txt += `├─━━━━━━━━━━━━━━━━━┤\n`
            txt += `│ ⚔️!guerra → Guerra completa\n`
            txt += `│ 🚨!faltan → Solo faltan + tag\n`
            txt += `│ 🏆!top → Top 10 PG\n`
            txt += `│ 🏰!clan → Info del clan VIP\n`
            txt += `│ 👤!perfil #TAG → Perfil VIP\n`
            txt += `│ 📦!cofres #TAG → Ciclo cofres\n`
            txt += `│ 🃏!mazos #TAG → Mazos top\n`
            txt += `│ 💤!inactivos → Inactivos +2d\n`
            txt += `╰─━━━━━━━━━━━━━━━━━╯\n`
            txt += `💎 _Exclusivo #GJCP9C8Y_`
            return sock.sendMessage(jid, { text: txt })
        }

        if (lower === "!ping") return sock.sendMessage(jid, { text: "💎 Pong! VIP+ activo 24/7 ⚡" })

        if (lower === "!clan") {
            try {
                const { data } = await axios.get(`${API_URL}/clan/${CLAN_TAG}`)
                let txt = `╭─ 💎 *CLAN VIP+* ─╮\n`
                txt += `│ 🏰 *${data.name}*\n│ 🏷️ ${data.tag} | 👥 ${data.members}/50\n├──────────────────┤\n`
                txt += `│ 🏆 Trofeos: ${data.clanScore}\n│ ⚔️ Guerra: ${data.warTrophies}\n│ 📍 ${data.location?.name || 'Internacional'}\n├──────────────────┤\n│ 📝 ${data.description}\n╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ API dormida, intenta en 20s" }) }
        }

        if (lower === "!guerra" || lower === "!faltan" || lower === "!top") {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 15000 })
                const participantes = data.clan.participants.sort((a,b)=> b.fame - a.fame)
                const atacaron = participantes.filter(p => p.decksUsed === 4)
                const faltan = participantes.filter(p => p.decksUsed < 4)

                if (lower === "!faltan") {
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `╭─ ✅ *GUERRA PERFECTA* ─╮\n│ Todos atacaron 4/4 🔥\n╰──────────────────╯` })
                    let txt = `╭─ 🚨 *FALTAN ${faltan.length} - PANCAKES* ─╮\n`
                    txt += `│ ❌ Faltan: ${faltan.length} / ${participantes.length}\n`
                    txt += `├──────────────────────┤\n`
                    let mentions = []
                    faltan.forEach(p=>{
                        const jidM = buscarJid(p.name)
                        if(jidM){ mentions.push(jidM); txt += `│ 💀 @${jidM.split('@')[0]} → ${p.decksUsed}/4 | PG:${p.fame}\n` }
                        else txt += `│ 💀 ${p.name} → ${p.decksUsed}/4 | PG:${p.fame}\n`
                    })
                    txt += `╰──────────────────────╯\n⚠️ _¡Atacen o kick!_ 💀`
                    return sock.sendMessage(jid, { text: txt, mentions })
                }

                if (lower === "!top") {
                    let txt = `╭─ 🏆 *TOP PG VIP+* ─╮\n`
                    txt += `│ 👑 *Puntos de Guerra* 👑\n`
                    txt += `├──────────────────┤\n`
                    participantes.slice(0,10).forEach((p,i)=>{
                        const med = i===0?'🥇': i===1?'🥈': i===2?'🥉':`#${i+1}`
                        txt += `│ ${med} ${p.name} → ${p.fame} PG (${p.decksUsed}/4)\n`
                    })
                    txt += `╰──────────────────╯`
                    return sock.sendMessage(jid, { text: txt })
                }

                // GUERRA COMPLETA
                let mentions = []
                let faltanTxt = ""
                faltan.forEach(p=>{
                    const jidM = buscarJid(p.name)
                    if(jidM){ mentions.push(jidM); faltanTxt += `│ 💀 @${jidM.split('@')[0]} → ${p.decksUsed}/4 | PG:${p.fame}\n` }
                    else faltanTxt += `│ 💀 ${p.name} → ${p.decksUsed}/4 | PG:${p.fame}\n`
                })

                let txt = `╭─ ⚔️ *GUERRA PANCAKES❤️ 2.6* ─╮\n`
                txt += `│ 🏷️ #GJCP9C8Y | 👥 ${participantes.length} | 🔥 Puntos de Guerra: ${data.clan.fame}\n`
                txt += `├─ 📊 *RESUMEN* ─┤\n`
                txt += `│ ✅ Atacaron: ${atacaron.length} | ❌ Faltan: ${faltan.length}\n`
                txt += `├─ ✅ *ATACARON (${atacaron.length})* ─┤\n`
                atacaron.slice(0,8).forEach(p=> txt += `│ 🔥 ${p.name} → 4/4 | PG:${p.fame}\n`)
                if(atacaron.length>8) txt += `│ + ${atacaron.length-8} más...\n`
                txt += `├─ 🚨 *FALTAN (${faltan.length})* ─┤\n`
                txt += faltanTxt
                txt += `╰──────────────────────╯`
                return sock.sendMessage(jid, { text: txt, mentions })

            } catch(e){ return sock.sendMessage(jid, { text: "❌ Sin guerra activa" }) }
        }

        if (lower.startsWith("!perfil")) {
            const tag = text.split(" ")[1]
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/perfil/${cleanTag}`)
                let txt = `╭─ 💎 *PERFIL VIP+* ─╮\n`
                txt += `│ 👤 *${data.name}*\n│ 🏷️ #${cleanTag}\n`
                txt += `├─ 📊 *STATS* ─┤\n`
                txt += `│ 🏆 ${data.trophies} | Max: ${data.bestTrophies}\n`
                txt += `│ ⭐ Nivel: ${data.expLevel} | 👑 Rey: ${data.kingLevel || data.expLevel}\n`
                txt += `│ ⚔️ Wins: ${data.wins} | War: ${data.warDayWins}\n`
                if(data.clan) txt += `├─ 🏰 ${data.clan.name}\n│ Rol: ${data.role}\n`
                txt += `╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Tag no encontrado" }) }
        }

        if (lower.startsWith("!cofres")) {
            const tag = text.split(" ")[1] || ""
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!cofres #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/cofres/${cleanTag}`)
                let txt = `╭─ 📦 *COFRES VIP+* ─╮\n│ 👤 ${data.name} #${cleanTag}\n├──────────────────┤\n`
                data.cofres.forEach((c,i)=>{ txt += `│ ${i===0?'👉': '▫️'} ${c} ${i===0? '← SIGUIENTE':''}\n` })
                txt += `╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ No se pudo obtener cofres" }) }
        }

        if (lower.startsWith("!mazos")) {
            const tag = text.split(" ")[1] || ""
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!mazos #TAG" })
            try {
                const cleanTag = tag.replace('#','').toUpperCase()
                const { data } = await axios.get(`${API_URL}/mazos/${cleanTag}`)
                let txt = `╭─ 🃏 *MAZOS TOP VIP+* ─╮\n│ 👤 ${data.name}\n├──────────────────┤\n`
                data.mazos.slice(0,3).forEach((m,i)=>{
                    txt += `│ *Mazo ${i+1}* - ${m.wins || 0} wins\n│ ${m.cartas?.join(' | ') || 'Mazo no disponible'}\n├──────────────────┤\n`
                })
                txt += `╰──────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ No se pudo obtener mazos" }) }
        }

        if (lower === "!inactivos") {
            try {
                const { data } = await axios.get(`${API_URL}/inactivos/${CLAN_TAG}`)
                if(data.total===0) return sock.sendMessage(jid, { text: "✅ Nadie inactivo 💎" })
                let txt = `╭─ 💤 *INACTIVOS VIP+ (${data.total})* ─╮\n`
                data.inactivos.slice(0,15).forEach(m=>{ txt += `│ 💀 ${m.name} - ${m.dias_off}d - ${m.rol}\n` })
                txt += `╰──────────────────────╯`
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Error" }) }
        }
    })
}
startBot()