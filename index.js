const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const axios = require('axios')
const P = require('pino')

const API_URL = process.env.API_URL || "https://tu-api.onrender.com" // CAMBIA ESTO POR TU LINK DE RENDER
const firma = `\n\n🤖 _Asistente Bot de Daniiel_`

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }) })
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { qr } = update
        if(qr) console.log(qr)
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        const jid = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        if (!text) return
        const lower = text.toLowerCase().trim()

        //!MENU
        if (lower === '!menu' || lower === '!ayuda' || lower === '!comandos') {
            let txt = `╭─━━━━━━━━━━━━━━╮\n`
            txt += `│ 💎 *ASISTENTE DE DANIIEL* 💎\n`
            txt += `│ 🤖 Bot oficial de Daniiel\n`
            txt += `├─━━━━━━━━━━━━━━┤\n`
            txt += `│ ⚔️!guerra → Reporte completo\n`
            txt += `│ 🚨!faltan → Quién falta por atacar\n`
            txt += `│ 👤!perfil #TAG → Perfil PRO\n`
            txt += `│ 📋!menu → Ver este menú\n`
            txt += `╰─━━━━━━━━━━━━━━╯`
            txt += firma + ` | PANCAKES VIP+`
            return sock.sendMessage(jid, { text: txt })
        }

        //!PERFIL
        if (lower.startsWith("!perfil")) {
            let tag = text.split(" ").find(t => t.includes('#')) || text.split(" ")[1] || ""
            tag = tag.replace(/[^A-Za-z0-9#]/g, '').replace('#','').toUpperCase().trim()
            if (!tag || tag.length < 3) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG\nEj:!perfil #2PP" + firma })
            try {
                console.log(`[PERFIL] ${tag} pedido en ${jid}`)
                const { data } = await axios.get(`${API_URL}/perfil/${tag}`, { timeout: 15000 })
                const favCard = data.currentFavouriteCard?.name || 'N/A'
                const currentDeck = data.currentDeck?.map(c=> c.name).join(', ') || 'Privado'
                const clanName = data.clan? `${data.clan.name} [${data.role || 'Miembro'}]` : 'Sin clan'
                const arena = data.arena?.name || 'Desconocida'
                const winRate = data.battleCount? Math.round((data.wins / data.battleCount)*100) : 0

                let txt = `╭─ 💎 *PERFIL PRO* ─╮\n`
                txt += `│ 👤 *${data.name}* | #${tag}\n`
                txt += `│ 🏰 ${clanName}\n`
                txt += `│ 🏆 ${data.trophies} | Récord: ${data.bestTrophies}\n`
                txt += `│ 🗺️ ${arena} | ⭐ Nv ${data.expLevel}\n`
                txt += `│ ⚔️ ${data.battleCount||0} batallas | ${winRate}% win\n`
                txt += `│ 👑 3 Coronas: ${data.threeCrownWins||0} | WarWins: ${data.warDayWins||0}\n`
                txt += `│ ❤️ Fav: ${favCard}\n`
                txt += `│ 🎴 Mazo: ${currentDeck.substring(0,90)}\n`
                txt += `╰─ 💎 *VIP+* ─╯`
                txt += firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                console.log("Error perfil:", e.message)
                return sock.sendMessage(jid, { text: `❌ Tag #${tag} no encontrado` + firma })
            }
        }

        //!GUERRA y!FALTAN
        if (lower.startsWith("!guerra") || lower.startsWith("!faltan")) {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 20000 })

                let groupMeta = null
                try {
                    if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid)
                } catch(e){}

                const buscarJid = (nombre) => {
                    if (!groupMeta ||!groupMeta.participants) return null
                    const nombreLower = nombre.toLowerCase().trim()
                    let m = groupMeta.participants.find(p =>
                        (p.notify && p.notify.toLowerCase() === nombreLower) ||
                        (p.name && p.name.toLowerCase() === nombreLower)
                    )
                    if (m) return m.id
                    m = groupMeta.participants.find(p => {
                        const n1 = (p.notify || "").toLowerCase()
                        const n2 = (p.name || "").toLowerCase()
                        if(n1.length < 3) return false
                        return n1.includes(nombreLower) || nombreLower.includes(n1) || n2.includes(nombreLower)
                    })
                    return m? m.id : null
                }

                if (lower.startsWith("!faltan")) {
                    const faltan = data.filter(p => p.ataquesRestantes > 0)
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ ¡Todos atacaron! Guerra completa.` + firma })

                    let txt = `🚨 *FALTAN ${faltan.length} POR ATACAR* 🚨\n\n`
                    let mentions = []
                    faltan.forEach(p => {
                        const jidM = buscarJid(p.name)
                        if(jidM){
                            mentions.push(jidM)
                            txt += `⚠️ @${jidM.split('@')[0]} - ${p.name} le faltan ${p.ataquesRestantes}\n`
                        } else {
                            txt += `⚠️ ${p.name} le faltan ${p.ataquesRestantes}\n`
                        }
                    })
                    txt += firma
                    return sock.sendMessage(jid, { text: txt, mentions: mentions })
                }

                //!guerra completo
                let txt = `⚔️ *REPORTE DE GUERRA* ⚔️\n\n`
                data.forEach(p => {
                    txt += `*${p.name}* - ${p.ataques} / 4 - ${p.fama} fama\n`
                })
                txt += `\n💎 *PANCAKES VIP+ V2*`
                txt += firma
                return sock.sendMessage(jid, { text: txt })

            } catch(e){
                console.log("Error guerra:", e.message)
                return sock.sendMessage(jid, { text: "❌ Error obteniendo guerra, intenta más tarde." + firma })
            }
        }
    })
}
startBot()
