import express from 'express'
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import axios from 'axios'
import P from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
let lastQR = null


const API_URL = (process.env.API_URL || "https://bot-clash-royale-backend.onrender.com").replace(/\/$/, "")
const CLAN_TAG = (process.env.CLAN_TAG || "GJCP9C8Y").replace('#','').toUpperCase()
const firma = '\n\n _Asistente Bot de Daniiel_'

// --- SERVIDOR WEB PARA QUE NO SE DUERMA EN RENDER/RAILWAY ---
const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req,res) => {
  res.status(200).send(`✅ BOT PANCAKES VIP+ ONLINE - ${new Date().toLocaleString()}`)
})
app.get('/qr', async (req,res) => {
  if(!lastQR) return res.send('<h2>❌ No hay QR, reinicia el bot en Railway -> Restart</h2>')
  try{
    const qrImage = await QRCode.toDataURL(lastQR)
    res.send(`<html><body style="text-align:center;font-family:sans-serif"><h1>Escanea este QR - PANCAKES VIP+ - ING. DANIIEL</h1><img src="${qrImage}" style="width:400px;height:400px"/><p>Se actualiza solo cada 20 seg</p><script>setTimeout(()=>location.reload(),15000)</script></body></html>`)
  }catch(e){ res.send('Error QR') }
})
app.listen(PORT, () => console.log(`🌐 Servidor web activo en puerto ${PORT}`))
// --- FIN SERVIDOR WEB ---

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }) })
    sock.ev.on('creds.update', saveCreds)
  
 sock.ev.on('connection.update', (u) => { 
  if(u.qr){
        lastQR = u.qr
    console.log('=== ESCANEA ESTE QR ING ===')
    qrcode.generate(u.qr, {small: true})
  }
  if(u.connection === 'open') console.log('✅ CONECTADO')
})

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        const jid = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        if (!text) return
        const lower = text.toLowerCase().trim()

        if (lower === '!menu' || lower === '!ayuda') {
            let txt = `╭─━━━━━━━━━━━━━━━━╮\n│ 💎 *SISTEMA PRO - ING. DANIIEL* 💎\n│ 🤖 Asistente Bot de Daniiel\n├─━━━━━━━━━━━━━━━━┤\n│ ⚔️!guerra → Reporte PG\n│ 🚨!faltan → Faltan por atacar\n│ 💤!inactivos → Inactivos PRO\n│ 🏰!clan → Info clan PRO MAX\n│ 👤!perfil #TAG → Perfil PRO\n╰─━━━━━━━━━━━━━━━━╯` + firma + ` | PANCAKES VIP+ | v5.0 PRO`
            return sock.sendMessage(jid, { text: txt })
        }

        //!PERFIL - ya compatible con tu backend
       //!PERFIL - MEJORADO PRO MAX ING. DANIIEL
        if (lower.startsWith("!perfil")) {
            let tag = text.split(" ").find(t => t.includes('#')) || text.split(" ")[1] || ""
            tag = tag.replace(/[^A-Za-z0-9#]/g, '').replace('#','').toUpperCase().trim()
            if (!tag) return sock.sendMessage(jid, { text: "❌ Usa:!perfil #TAG\nEj:!perfil #2PP" + firma })
            try {
                const { data } = await axios.get(`${API_URL}/perfil/${tag}`, { timeout: 20000 })

                const winRate = data.battleCount? Math.round((data.wins / data.battleCount)*100) : 0
                const clanInfo = data.clan? `${data.clan.name} [${data.clan.tag}] | Rol: ${data.role || 'Miembro'}` : 'Sin clan'
                const favCard = data.currentFavouriteCard?.name || 'N/A'
                const totalDonas = data.totalDonations || data.donations || 0
                const guerraWins = data.warDayWins || 0
                const challengeWins = data.challengeMaxWins || 0

                let txt = `╭─━━━━━━━━━━━━━━━━━━━━━╮\n`
                txt += `│ 💎 *PERFIL PRO - ING. DANIIEL* 💎\n`
                txt += `├─━━━━━━━━━━━━━━━━━━━━━┤\n`
                txt += `│ 👤 *${data.name}* | #${tag}\n`
                txt += `│ 🏰 ${clanInfo}\n`
                txt += `├─ 📊 *ESTADÍSTICAS* ─┤\n`
                txt += `│ 🏆 Trofeos: ${data.trophies} | Récord: ${data.bestTrophies}\n`
                txt += `│ ⭐ Nivel: ${data.expLevel} | Nv Torre: ${data.expPoints? Math.floor(data.expLevel) : data.expLevel}\n`
                txt += `│ ⚔️ Batallas: ${data.battleCount} | Victorias: ${data.wins} | Derrotas: ${data.losses || (data.battleCount - data.wins)}\n`
                txt += `│ 📈 WinRate: ${winRate}% | Racha: ${data.threeCrownWins || 0} x3👑\n`
                txt += `│ 🎁 Donaciones: ${totalDonas} | Recibidas: ${data.clanCardsCollected || 0}\n`
                txt += `├─ 🏆 *GUERRA & DESAFÍOS* ─┤\n`
                txt += `│ 🛡️ War Wins: ${guerraWins} | Challenge Max: ${challengeWins}\n`
                txt += `│ ❤️ Carta Fav: ${favCard}\n`
                txt += `│ 🃏 Cartas: ${data.cards? Object.keys(data.cards).length : 'N/A'} | Nivel Estrella: ${data.starPoints || 0} ⭐\n`
                txt += `╰─━━━━━━━━━━━━━━━━━━━━━╯\n`
                txt += `💎 *PANCAKES VIP+ | SISTEMA PRO*` + firma

                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                console.log(e.message)
                return sock.sendMessage(jid, { text: `❌ Tag #${tag} no encontrado o API caída` + firma })
            }
        }

        //!CLAN - ARREGLADO A TU RUTA /clan/TAG
        if (lower === '!clan') {
            try {
                await sock.sendMessage(jid, { text: "🏰 Obteniendo datos PRO del clan... 3 seg" + firma })
                const { data: clan } = await axios.get(`${API_URL}/clan/${CLAN_TAG}`, { timeout: 20000 })

                const members = clan.memberList || []
                const totalDonas = members.reduce((a,m)=> a + (m.donations||0), 0)
                const totalRecibidas = members.reduce((a,m)=> a + (m.donationsReceived||0), 0)
                const promedio = members.length? Math.round(members.reduce((a,m)=> a + (m.trophies||0),0)/members.length) : 0
                const topDonador = [...members].sort((a,b)=> (b.donations||0)-(a.donations||0))[0]
                const topTrofeos = [...members].sort((a,b)=> (b.trophies||0)-(a.trophies||0))[0]

                let txt = `╭─━━━━━━━━━━━━━━━━━━━━━╮\n`
                txt += `│ 🏰 *CLAN PRO - ING. DANIIEL* 🏰\n`
                txt += `├─━━━━━━━━━━━━━━━━━━━━━┤\n`
                txt += `│ 💎 *${clan.name}* [${clan.tag}]\n`
                txt += `│ 📝 ${clan.description?.substring(0,100) || ''}\n`
                txt += `├─━━━━━━━━━━━━━━━━━━━━━┤\n`
                txt += `│ 🏆 Trofeos: ${clan.clanScore}\n`
                txt += `│ ⚔️ Guerra: ${clan.clanWarTrophies}\n`
                txt += `│ 👥 Miembros: ${clan.members}/50\n`
                txt += `│ 🌎 ${clan.location?.name || 'Int.'} | Req: ${clan.requiredTrophies} 🏆\n`
                txt += `│ 🎁 Donas/sem: ${clan.donationsPerWeek}\n`
                txt += `├─ 📊 *ESTADÍSTICAS PRO* ─┤\n`
                txt += `│ 🎁 Totales: ${totalDonas} | 📥 ${totalRecibidas}\n`
                txt += `│ 📈 Prom: ${promedio}\n`
                txt += `│ 👑 Top Dona: ${topDonador?.name} (${topDonador?.donations})\n`
                txt += `│ 🏆 Top Trof: ${topTrofeos?.name} (${topTrofeos?.trophies})\n`
                txt += `├─ 👥 *TOP 5* ─┤\n`
                const top5 = [...members].sort((a,b)=> b.trophies - a.trophies).slice(0,5)
                top5.forEach((m,i)=>{
                    txt += `│ ${i+1}. ${m.name} - ${m.trophies}🏆 | ${m.donations}🎁 | ${m.role}\n`
                })
                txt += `╰─━━━━━━━━━━━━━━━━━━━━━╯\n💎 *PANCAKES VIP+ | ING. DANIIEL*` + firma
                return sock.sendMessage(jid, { text: txt })
            } catch(e){
                console.log("Error clan:", e.message)
                return sock.sendMessage(jid, { text: `❌ Error clan: ${e.message}` + firma })
            }
        }

        //!GUERRA y!FALTAN - ARREGLADO A TU JSON
       //!GUERRA - COMPLETO PRO MAX ING. DANIIEL - CON FALTANTES INCLUIDOS
      //!GUERRA + FALTAN COMBINADOS - DISEÑO FOTO - PRO ING. DANIIEL
        if (lower === '!guerra' || lower.startsWith('!guerra ') || lower === '!faltan' || lower.startsWith('!faltan ')) {
            try {
                const esFaltan = lower.startsWith('!faltan')
                const { data: race } = await axios.get(`${API_URL}/guerra/${CLAN_TAG}`, { timeout: 25000 })
                const participantes = race.clan?.participants || []
                const totalMiembros = participantes.length || 0

                if(participantes.length === 0) return sock.sendMessage(jid, { text: `❌ No hay guerra activa` + firma })

                participantes.sort((a,b)=> (b.fame||0)-(a.fame||0))
                const totalPG = participantes.reduce((a,p)=> a + (p.fame||0), 0)
                const promPG = totalMiembros? Math.round(totalPG / totalMiembros) : 0
                const totalAtksUsados = participantes.reduce((a,p)=> a + (p.decksUsedToday||0), 0)
                const totalAtksMax = totalMiembros * 4
                const porcentaje = totalAtksMax? Math.round((totalAtksUsados / totalAtksMax)*100) : 0
                const completaron = participantes.filter(p=> (p.decksUsedToday||0) === 4)
                const faltan = participantes.filter(p=> (p.decksUsedToday||0) < 4).sort((a,b)=> (a.decksUsedToday||0)-(b.decksUsedToday||0))

                // Barra tipo foto
                const bloques = 10
                const llenos = Math.round((porcentaje/100)*bloques)
                const barra = "█".repeat(llenos) + "░".repeat(bloques-llenos)

                let txt = ""
                let mentions = []

                if(esFaltan){
                    // ---- !FALTAN SOLO ----
                    if(faltan.length === 0) return sock.sendMessage(jid, { text: `✅ ¡Todos atacaron! ${totalAtksUsados}/${totalAtksMax}` + firma })

                    let groupMeta = null
                    try { if (jid.endsWith('@g.us')) groupMeta = await sock.groupMetadata(jid) } catch(e){}
                    const buscarJid = (nombre) => {
                        if (!groupMeta) return null
                        let m = groupMeta.participants.find(p => (p.notify?.toLowerCase() === nombre.toLowerCase() || p.id.includes(nombre.toLowerCase().replace(/\s/g,''))))
                        return m? m.id : null
                    }

                    txt = `╭─ 🚨 *FALTAN (${faltan.length}) - PANCAKES* ─╮\n`
                    txt += `│ 🏷️ #${CLAN_TAG} | 📊 ${totalAtksUsados}/${totalAtksMax} | ${porcentaje}%\n`
                    txt += `├─ 🔥 *LISTA* ─┤\n`

                    faltan.forEach(p=>{
                        const atk = p.decksUsedToday||0
                        const pg = p.fame||0
                        const circulos = "🔴".repeat(4-atk) + "🟢".repeat(atk)
                        const jidM = buscarJid(p.name)
                        if(jidM){
                            mentions.push(jidM)
                            txt += `│ ${circulos} @${jidM.split('@')[0]} → ${atk}/4 | ${pg} PG\n`
                        } else {
                            txt += `│ ${circulos} ${p.name} → ${atk}/4 | ${pg} PG\n`
                        }
                    })
                    txt += `╰─━━━━━━━━━━━━━━━━━━━━╯` + firma
                    return sock.sendMessage(jid, { text: txt, mentions })

                } else {
                    // ---- !GUERRA COMPLETO ----
                    txt = `╭─ ⚔️ *REPORTE GUERRA PRO - PANCAKES* ─╮\n`
                    txt += `│ 🏷️ #${CLAN_TAG} | 👥 ${totalMiembros} miembros\n`
                    txt += `│ 🔥 ${totalPG} PG | 📊 Prom: ${promPG} PG\n`
                    txt += `│ ${barra} ${porcentaje}% (${totalAtksUsados}/${totalAtksMax})\n`
                    txt += `├─ 📊 *RESUMEN* ─┤\n`
                    txt += `│ ✅ Completaron: ${completaron.length} | ❌ Faltan: ${faltan.length}\n`
                    txt += `├─ 🏆 *TOP 5 MVP* ─┤\n`

                    participantes.slice(0,5).forEach((p,i)=>{
                        const medalla = i===0? "🥇 " : i===1? "🥈 " : i===2? "🥉 " : `#${i+1} `
                        txt += `│ ${medalla}${p.name} → ${p.fame||0} PG\n`
                    })

                    if(faltan.length > 0){
                        txt += `├─ 🚨 *FALTAN (${faltan.length})* ─┤\n`
                        faltan.slice(0,20).forEach(p=>{
                            const atk = p.decksUsedToday||0
                            const circulos = "🔴".repeat(4-atk) + "🟢".repeat(atk)
                            txt += `│ ${circulos} ${p.name} → ${atk}/4 | ${p.fame||0} PG\n`
                        })
                        if(faltan.length > 20) txt += `│ ...y ${faltan.length-20} más. Usa !faltan\n`
                    } else {
                        txt += `├─ ✅ *TODOS COMPLETARON* ─┤\n`
                    }
                    txt += `╰─━━━━━━━━━━━━━━━━━━━━╯` + firma
                    return sock.sendMessage(jid, { text: txt })
                }

            } catch(e){
                console.log("Error guerra/faltan:", e.message)
                return sock.sendMessage(jid, { text: `❌ Error: ${e.message}` + firma })
            }
        }

        //!INACTIVOS - ARREGLADO
        if (lower.startsWith("!inactivos")) {
            try {
                const { data } = await axios.get(`${API_URL}/inactivos/${CLAN_TAG}`, { timeout: 20000 })
                if(data.total === 0) return sock.sendMessage(jid, { text: "✅ No hay inactivos" + firma })
                let txt = `💤 *INACTIVOS - ING. DANIIEL* 💤\nTotal: ${data.total}\n\n`
                data.inactivos.forEach(i=>{
                    txt += `💤 ${i.name} - ${i.rol} | ${i.dias_off} días off\n`
                })
                return sock.sendMessage(jid, { text: txt + firma })
            } catch(e){
                return sock.sendMessage(jid, { text: "❌ Error inactivos" + firma })
            }
        }
    })
}
startBot()
