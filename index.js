import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import axios from 'axios'
import P from 'pino'

const CLAN_TAG = (process.env.CLAN_TAG || "").replace('#','').toUpperCase()
const TOKEN = process.env.CLASH_ROYALE_TOKEN
const firma = `\n\n🤖 _Asistente Bot de Daniiel_`

const headers = { Authorization: `Bearer ${TOKEN}` }

async function getGuerraData(){
    // 1. River Race actual
    const url = `https://api.clashroyale.com/v1/clans/%23${CLAN_TAG}/currentriverrace`
    const { data } = await axios.get(url, { headers, timeout: 15000 })

    const clan = data.clan
    // clan.participants = lista guerra
    const participantes = clan.participants.map(p => ({
        name: p.name,
        tag: p.tag,
        ataques: p.decksUsed || 0,
        ataquesRestantes: 4 - (p.decksUsed || 0),
        puntosGuerra: p.fame || 0,
        PG: p.fame || 0,
        reparaciones: p.repairPoints || 0
    }))
    return participantes.sort((a,b)=> b.puntosGuerra - a.puntosGuerra)
}

async function getClanData(){
    const url = `https://api.clashroyale.com/v1/clans/%23${CLAN_TAG}`
    const { data } = await axios.get(url, { headers, timeout: 15000 })
    return data
}

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

        if (lower === '!menu') {
            let txt = `╭─━━━━━━━━━━━━━━╮\n│ 💎 *ASISTENTE DE DANIIEL* 💎\n├─━━━━━━━━━━━━━━┤\n│ ⚔️!guerra → Reporte PG\n│ 🚨!faltan → Faltan por atacar\n│ 💤!inactivos → Inactivos\n│ 👤!perfil #TAG → Perfil\n╰─━━━━━━━━━━━━━━╯` + firma
            return sock.sendMessage(jid, { text: txt })
        }

        if (lower.startsWith("!guerra") || lower.startsWith("!faltan")) {
            try {
                const data = await getGuerraData()
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

                if (lower.startsWith("!faltan")) {
                    const faltan = data.filter(p => p.ataquesRestantes > 0)
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ ¡Todos atacaron!` + firma })
                    let txt = `🚨 *FALTAN ${faltan.length} POR ATACAR* 🚨\n\n`
                    let mentions = []
                    faltan.forEach(p => {
                        const j = buscarJid(p.name)
                        if(j){ mentions.push(j); txt += `⚠️ @${j.split('@')[0]} - ${p.name} | ${p.PG} PG | faltan ${p.ataquesRestantes}\n` }
                        else txt += `⚠️ ${p.name} | ${p.PG} PG | faltan ${p.ataquesRestantes}\n`
                    })
                    return sock.sendMessage(jid, { text: txt + firma, mentions })
                }

                let txt = `⚔️ *REPORTE GUERRA - PUNTOS DE GUERRA* ⚔️\n\n`
                data.forEach(p => txt += `*${p.name}* - ${p.ataques}/4 - ${p.PG} PG\n`)
                return sock.sendMessage(jid, { text: txt + firma })

            } catch(e){
                console.log("Error guerra:", e.response?.data || e.message)
                return sock.sendMessage(jid, { text: `❌ Error obteniendo guerra: ${e.message}` + firma })
            }
        }

        if (lower.startsWith("!inactivos")) {
            try {
                const guerra = await getGuerraData()
                const clan = await getClanData()

                let groupMeta = null
                try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
                const buscarJid = (nombre) => {
                    if (!groupMeta) return null
                    const nL = nombre.toLowerCase().trim()
                    let m = groupMeta.participants.find(p => (p.notify?.toLowerCase() === nL))
                    return m? m.id : null
                }

                let txt = `💤 *REPORTE INACTIVOS* 💤\nFiltros: <100 donas | <3 ataques | 0 PG\n\n`
                let mentions = []
                let count = 0
                clan.memberList.forEach(m => {
                    const enGuerra = guerra.find(g => g.tag === m.tag) || { ataques: 0, PG: 0, ataquesRestantes: 4 }
                    if (m.donations < 100 || enGuerra.ataques < 3 || enGuerra.PG === 0) {
                        count++
                        const j = buscarJid(m.name)
                        if(j) mentions.push(j)
                        const mentionTxt = j? `@${j.split('@')[0]}` : m.name
                        txt += `💤 ${mentionTxt} - ${m.name}\n └ 🃏 Donas: ${m.donations} | ⚔️ ${enGuerra.ataques}/4 | 🛡️ ${enGuerra.PG} PG\n`
                    }
                })
                txt += `\n⚠️ Total: ${count} inactivos` + firma
                return sock.sendMessage(jid, { text: txt, mentions })
            } catch(e){
                console.log("Error inactivos:", e.message)
                return sock.sendMessage(jid, { text: "❌ Error inactivos" + firma })
            }
        }

        if (lower.startsWith("!perfil")) {
            let tag = text.split(" ").find(t => t.includes('#')) || text.split(" ")[1] || ""
            tag = tag.replace(/[^A-Za-z0-9#]/g, '').replace('#','').toUpperCase().trim()
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG" + firma })
            try {
                const { data } = await axios.get(`https://api.clashroyale.com/v1/players/%23${tag}`, { headers })
                let txt = `💎 *${data.name}* #${tag}\n🏆 ${data.trophies} | Nv ${data.expLevel}\n🏰 ${data.clan?.name || 'Sin clan'}\n⚔️ WarWins: ${data.warDayWins}` + firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){ return sock.sendMessage(jid, { text: "❌ Tag no encontrado" + firma }) }
        }
    })
}
startBot()
