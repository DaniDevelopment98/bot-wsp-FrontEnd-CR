import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import axios from 'axios'
import P from 'pino'

const API_URL = process.env.API_URL || "https://tu-api.onrender.com"
const firma = `\n\n🤖 _Asistente Bot de Daniiel_`

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }) })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => { if(u.qr) console.log(u.qr) })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        const jid = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        if (!text) return
        const lower = text.toLowerCase().trim()

        if (lower === '!menu' || lower === '!ayuda') {
            let txt = `╭─━━━━━━━━━━━━━━╮\n`
            txt += `│ 💎 *ASISTENTE DE DANIIEL* 💎\n`
            txt += `│ 🤖 Bot oficial de Daniiel\n`
            txt += `├─━━━━━━━━━━━━━━┤\n`
            txt += `│ ⚔️!guerra → Reporte guerra (PG)\n`
            txt += `│ 🚨!faltan → Faltan por atacar\n`
            txt += `│ 👤!perfil #TAG → Perfil PRO\n`
            txt += `│ 💤!inactivos → Inactivos + offline\n`
            txt += `╰─━━━━━━━━━━━━━━╯`
            txt += firma + ` | PANCAKES VIP+`
            return sock.sendMessage(jid, { text: txt })
        }

        if (lower.startsWith("!perfil")) {
            let tag = text.split(" ").find(t => t.includes('#')) || text.split(" ")[1] || ""
            tag = tag.replace(/[^A-Za-z0-9#]/g, '').replace('#','').toUpperCase().trim()
            if (!tag || tag.length < 3) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG" + firma })
            try {
                const { data } = await axios.get(`${API_URL}/perfil/${tag}`, { timeout: 15000 })
                let txt = `╭─ 💎 *PERFIL PRO* ─╮\n│ 👤 *${data.name}* | #${tag}\n│ 🏆 ${data.trophies} | Récord: ${data.bestTrophies}\n│ 🏰 ${data.clan?.name || 'Sin clan'}\n╰─ 💎 *VIP+* ─╯` + firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                return sock.sendMessage(jid, { text: `❌ Tag #${tag} no encontrado` + firma })
            }
        }

        if (lower.startsWith("!guerra") || lower.startsWith("!faltan")) {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 20000 })
                let groupMeta = null
                try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
                const buscarJid = (nombre) => {
                    if (!groupMeta) return null
                    const nL = nombre.toLowerCase().trim()
                    let m = groupMeta.participants.find(p => (p.notify?.toLowerCase() === nL) || (p.name?.toLowerCase() === nL))
                    if(m) return m.id
                    m = groupMeta.participants.find(p => (p.notify||"").toLowerCase().includes(nL.substring(0,4)))
                    return m? m.id : null
                }

                if (lower.startsWith("!faltan")) {
                    const faltan = data.filter(p => p.ataquesRestantes > 0)
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ ¡Todos atacaron! Guerra completa.` + firma })
                    let txt = `🚨 *FALTAN ${faltan.length} POR ATACAR* 🚨\n\n`
                    let mentions = []
                    faltan.forEach(p => {
                        const pg = p.puntosGuerra?? p.fama?? 0
                        const j = buscarJid(p.name)
                        if(j){ mentions.push(j); txt += `⚠️ @${j.split('@')[0]} - ${p.name} | ${pg} PG | faltan ${p.ataquesRestantes}\n` }
                        else txt += `⚠️ ${p.name} | ${pg} PG | faltan ${p.ataquesRestantes}\n`
                    })
                    return sock.sendMessage(jid, { text: txt + firma, mentions })
                }

                //!guerra - CAMBIADO A PG
                let txt = `⚔️ *REPORTE DE GUERRA - PUNTOS DE GUERRA* ⚔️\n\n`
                data.forEach(p => {
                    const pg = p.puntosGuerra?? p.fama?? 0
                    txt += `*${p.name}* - ${p.ataques}/4 ataques - ${pg} PG\n`
                })
                txt += `\n💎 *PANCAKES VIP+ V2*` + firma
                return sock.sendMessage(jid, { text: txt })

            } catch(e){ return sock.sendMessage(jid, { text: "❌ Error obteniendo guerra" + firma }) }
        }

        if (lower.startsWith("!inactivos")) {
            try {
                await sock.sendMessage(jid, { text: "💤 Analizando inactivos..." + firma })
                let clanData
                try {
                    const r = await axios.get(`${API_URL}/inactivos`, { timeout: 20000 })
                    clanData = r.data
                } catch {
                    const r = await axios.get(`${API_URL}/clan`, { timeout: 20000 })
                    clanData = r.data.memberList || r.data
                }

                let groupMeta = null
                try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
                const buscarJid = (nombre) => {
                    if (!groupMeta) return null
                    const nL = nombre.toLowerCase().trim()
                    let m = groupMeta.participants.find(p => (p.notify?.toLowerCase() === nL))
                    if(m) return m.id
                    m = groupMeta.participants.find(p => (p.notify||"").toLowerCase().includes(nL.substring(0,4)))
                    return m? m.id : null
                }

                const inactivos = []
                for(let m of clanData){
                    const donaciones = m.donations || 0
                    const ataques = m.ataques?? m.warAttacks?? m.puntosGuerra?? 4
                    const pg = m.puntosGuerra?? m.fama?? 0
                    const offline = m.offlineDays?? 0
                    if(donaciones < 50 || ataques < 3 || offline >= 2){
                        inactivos.push({ name: m.name, donaciones, ataques, pg, offline })
                    }
                }

                if(inactivos.length === 0) return sock.sendMessage(jid, { text: "✅ No hay inactivos" + firma })

                let txt = `💤 *REPORTE INACTIVOS* 💤\nFiltros: <50 donas | <3 ataques | 2+ días offline\n\n`
                let mentions = []
                inactivos.forEach(p => {
                    const j = buscarJid(p.name)
                    if(j){ mentions.push(j); txt += `💤 @${j.split('@')[0]} - ${p.name}\n └ 🃏 Donas: ${p.donaciones} | ⚔️ Ataques: ${p.ataques} | 🛡️ ${p.pg} PG | 💤 ${p.offline}d\n` }
                    else txt += `💤 ${p.name}\n └ 🃏 Donas: ${p.donaciones} | ⚔️ Ataques: ${p.ataques} | 🛡️ ${p.pg} PG | 💤 ${p.offline}d\n`
                })
                txt += `\n⚠️ Total: ${inactivos.length} inactivos` + firma
                return sock.sendMessage(jid, { text: txt, mentions })

            } catch(e){
                return sock.sendMessage(jid, { text: "❌ No pude obtener inactivos" + firma })
            }
        }
    })
}
startBot()
