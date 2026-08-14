import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import axios from 'axios'
import P from 'pino'

const API_URL = process.env.API_URL || "https://bot-clash-royale-backend.onrender.com"
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

        //!MENU
        if (lower === '!menu' || lower === '!ayuda') {
            let txt = `╭─━━━━━━━━━━━━━━━━╮\n`
            txt += `│ 💎 *SISTEMA PRO - ING. DANIIEL* 💎\n`
            txt += `│ 🤖 Asistente Bot de Daniiel\n`
            txt += `├─━━━━━━━━━━━━━━━━┤\n`
            txt += `│ ⚔️!guerra → Reporte PG\n`
            txt += `│ 🚨!faltan → Faltan por atacar\n`
            txt += `│ 💤!inactivos → Inactivos PRO\n`
            txt += `│ 🏰!clan → Info clan PRO MAX\n`
            txt += `│ 👤!perfil #TAG → Perfil PRO\n`
            txt += `╰─━━━━━━━━━━━━━━━━╯`
            txt += firma + ` | PANCAKES VIP+ | v5.0 PRO`
            return sock.sendMessage(jid, { text: txt })
        }

        //!PERFIL
        if (lower.startsWith("!perfil")) {
            let tag = text.split(" ").find(t => t.includes('#')) || text.split(" ")[1] || ""
            tag = tag.replace(/[^A-Za-z0-9#]/g, '').replace('#','').toUpperCase().trim()
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG\nEj:!perfil #2PP" + firma })
            try {
                const { data } = await axios.get(`${API_URL}/perfil/${tag}`, { timeout: 20000 })
                const fav = data.currentFavouriteCard?.name || 'N/A'
                const clan = data.clan? `${data.clan.name}` : 'Sin clan'
                const winRate = data.battleCount? Math.round((data.wins / data.battleCount)*100) : 0
                let txt = `╭─ 💎 *PERFIL PRO* ─╮\n`
                txt += `│ 👤 *${data.name}* | #${tag}\n`
                txt += `│ 🏰 ${clan}\n`
                txt += `│ 🏆 ${data.trophies} | Récord: ${data.bestTrophies}\n`
                txt += `│ ⭐ Nv ${data.expLevel} | WinRate: ${winRate}%\n`
                txt += `│ ❤️ Fav: ${fav}\n`
                txt += `╰─ 💎 *VIP+* ─╯` + firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                console.log("Error perfil:", e.response?.data || e.message)
                return sock.sendMessage(jid, { text: `❌ Tag #${tag} no encontrado` + firma })
            }
        }

        //!CLAN - NUEVO PRO MAX
        if (lower === '!clan') {
            try {
                await sock.sendMessage(jid, { text: "🏰 Obteniendo datos PRO del clan... 3 seg" + firma })
                let clan
                try {
                    const r = await axios.get(`${API_URL}/clan`, { timeout: 20000 })
                    clan = r.data
                    if(r.data.memberList &&!r.data.members) clan = r.data // tu backend manda directo el clan
                } catch {
                    const r = await axios.get(`${API_URL}/clan`, { timeout: 20000 })
                    clan = r.data
                }

                const members = clan.memberList || clan.members || []
                const totalDonas = members.reduce((a,m)=> a + (m.donations||0), 0)
                const totalDonasRecibidas = members.reduce((a,m)=> a + (m.donationsReceived||0), 0)
                const promedioTrofeos = members.length? Math.round(members.reduce((a,m)=> a + (m.trophies||0),0)/members.length) : 0
                const topDonador = [...members].sort((a,b)=> (b.donations||0) - (a.donations||0))[0]
                const topTrofeos = [...members].sort((a,b)=> (b.trophies||0) - (a.trophies||0))[0]
                const veteranos = members.filter(m=> m.role === 'elder' || m.role === 'coLeader' || m.role === 'leader').length

                let txt = `╭─━━━━━━━━━━━━━━━━━━━━━╮\n`
                txt += `│ 🏰 *CLAN PRO - ING. DANIIEL* 🏰\n`
                txt += `├─━━━━━━━━━━━━━━━━━━━━━┤\n`
                txt += `│ 💎 *${clan.name}* ${clan.tag? `[${clan.tag}]` : ''}\n`
                txt += `│ 📝 ${clan.description? clan.description.substring(0,120) : 'Sin descripción'}\n`
                txt += `├─━━━━━━━━━━━━━━━━━━━━━┤\n`
                txt += `│ 🏆 Trofeos Clan: ${clan.clanScore||clan.score||0}\n`
                txt += `│ ⚔️ Trofeos Guerra: ${clan.clanWarTrophies||clan.warTrophies||0}\n`
                txt += `│ 👥 Miembros: ${clan.members?.length || members.length}/50\n`
                txt += `│ 🔰 Rol: ${veteranos} Staff | ${members.length - veteranos} Miembros\n`
                txt += `│ 🌎 Ubicación: ${clan.location?.name || 'Internacional'}\n`
                txt += `│ 🚪 Tipo: ${clan.type||'Abierto'} | Req: ${clan.requiredTrophies||0} 🏆\n`
                txt += `│ 🎁 Donas/sem: ${clan.donationsPerWeek||totalDonas}\n`
                txt += `├─ 📊 *ESTADÍSTICAS PRO* ─┤\n`
                txt += `│ 🎁 Donaciones Totales: ${totalDonas}\n`
                txt += `│ 📥 Recibidas Totales: ${totalDonasRecibidas}\n`
                txt += `│ 📈 Prom. Trofeos: ${promedioTrofeos}\n`
                txt += `│ 👑 Top Donador: ${topDonador?.name} (${topDonador?.donations} donas)\n`
                txt += `│ 🏆 Top Trofeos: ${topTrofeos?.name} (${topTrofeos?.trophies})\n`
                txt += `├─ 👥 *TOP 5 MIEMBROS* ─┤\n`
                const top5 = [...members].sort((a,b)=> b.trophies - a.trophies).slice(0,5)
                top5.forEach((m,i)=>{
                    const rol = m.role==='leader'? '👑 Líder' : m.role==='coLeader'? '💎 Colíder' : m.role==='elder'? '🔰 Veterano' : '👤 Miembro'
                    txt += `│ ${i+1}. ${m.name} - ${m.trophies}🏆 | ${m.donations}🎁 | ${rol}\n`
                })
                txt += `╰─━━━━━━━━━━━━━━━━━━━━━╯\n`
                txt += `💎 *PANCAKES VIP+ | SISTEMA ING. DANIIEL*`
                txt += firma

                return sock.sendMessage(jid, { text: txt })

            } catch(e){
                console.log("Error clan:", e.response?.data || e.message)
                return sock.sendMessage(jid, { text: `❌ Error obteniendo clan. Verifica que ${API_URL}/clan esté online` + firma })
            }
        }

        //!GUERRA y!FALTAN - YA CON PG
        if (lower.startsWith("!guerra") || lower.startsWith("!faltan")) {
            try {
                const { data } = await axios.get(`${API_URL}/guerra`, { timeout: 25000 })
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
                    const faltan = data.filter(p => (p.ataquesRestantes?? (4 - (p.ataques||0))) > 0)
                    if (faltan.length === 0) return sock.sendMessage(jid, { text: `✅ ¡Todos atacaron! Guerra completa.` + firma })
                    let txt = `🚨 *FALTAN ${faltan.length} POR ATACAR* 🚨\n\n`
                    let mentions = []
                    faltan.forEach(p => {
                        const pg = p.puntosGuerra?? p.PG?? p.fama?? p.f?? 0
                        const falt = p.ataquesRestantes?? (4 - (p.ataques||0))
                        const jidM = buscarJid(p.name)
                        if(jidM){ mentions.push(jidM); txt += `⚠️ @${jidM.split('@')[0]} - ${p.name} | ${pg} PG | faltan ${falt}\n` }
                        else txt += `⚠️ ${p.name} | ${pg} PG | faltan ${falt}\n`
                    })
                    return sock.sendMessage(jid, { text: txt + firma, mentions })
                }
                let txt = `⚔️ *REPORTE DE GUERRA - PUNTOS DE GUERRA* ⚔️\n\n`
                data.forEach(p => {
                    const pg = p.puntosGuerra?? p.PG?? p.fama?? p.f?? 0
                    const atk = p.ataques?? 0
                    txt += `*${p.name}* - ${atk}/4 - ${pg} PG\n`
                })
                txt += `\n💎 *PANCAKES VIP+ V2*` + firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                console.log("Error guerra:", e.message)
                return sock.sendMessage(jid, { text: `❌ Error obteniendo guerra: ${e.message}` + firma })
            }
        }

        //!INACTIVOS
        if (lower.startsWith("!inactivos")) {
            try {
                await sock.sendMessage(jid, { text: "💤 Analizando inactivos... 5 seg" + firma })
                let clanData
                try {
                    const r = await axios.get(`${API_URL}/inactivos`, { timeout: 20000 })
                    clanData = r.data
                } catch {
                    const r = await axios.get(`${API_URL}/clan`, { timeout: 20000 })
                    clanData = r.data.memberList || r.data
                }
                const guerra = await axios.get(`${API_URL}/guerra`, { timeout: 20000 }).then(r=>r.data).catch(()=>[])
                let groupMeta = null
                try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
                const buscarJid = (nombre) => {
                    if (!groupMeta) return null
                    const nL = nombre.toLowerCase().trim()
                    let m = groupMeta.participants.find(p => (p.notify?.toLowerCase() === nL))
                    return m? m.id : null
                }
                let txt = `💤 *REPORTE INACTIVOS - ING. DANIIEL* 💤\nFiltros: <100 donas | <3 ataques | 0 PG\n\n`
                let mentions = []
                let count = 0
                for(let m of clanData){
                    const enGuerra = guerra.find(g => g.name === m.name || g.tag === m.tag) || {}
                    const donas = m.donations || 0
                    const atk = enGuerra.ataques?? 0
                    const pg = enGuerra.puntosGuerra?? enGuerra.PG?? enGuerra.fama?? 0
                    if(donas < 100 || atk < 3 || pg === 0){
                        count++
                        const j = buscarJid(m.name)
                        if(j) mentions.push(j)
                        const mentionTxt = j? `@${j.split('@')[0]}` : m.name
                        txt += `💤 ${mentionTxt} - ${m.name}\n └ 🃏 Donas: ${donas} | ⚔️ ${atk}/4 | 🛡️ ${pg} PG\n`
                    }
                }
                if(count===0) return sock.sendMessage(jid, { text: "✅ No hay inactivos, todos activos" + firma })
                txt += `\n⚠️ Total: ${count} inactivos` + firma
                return sock.sendMessage(jid, { text: txt, mentions })
            } catch(e){
                console.log("Error inactivos:", e.message)
                return sock.sendMessage(jid, { text: "❌ No pude obtener inactivos." + firma })
            }
        }
    })
}
startBot()
