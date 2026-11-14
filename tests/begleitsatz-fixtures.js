// Testmelodien für den Begleitsatz.
// ACHTUNG: Das sind KEINE echten Gesänge, sondern kurze, für die Tests
// geschriebene Übungsmelodien (je Modus typischer Ambitus, Finalis, Tenor).
// Sie dienen als Eingabe für Regelprüfungen und als Schnappschuss des
// heutigen Verhaltens. Echte Gesänge mit Referenzsätzen kommen in
// tests/korpus/ dazu, sobald die Quelle entschieden ist (Konzept, Teil A.3).
//
// mode: erwarteter Modus (1–8); finalis/tenor als Tonname der Vorlage
// (untransponiert). opts: zusätzliche Optionen für clGabcToAbc.
module.exports = [
  { id: 'modus1', mode: 1, finalis: 'D', tenor: 'A', finalChord: 'd-Moll',
    gabc: "(c4) Tes(d)ti(f)mó(h)ni(h)um(hg) (,) mo(h)di(ixi) pri(h)mi(g) (;) de(f)cán(gh)tat(g) cho(f)rus(e) (:) in(d) fi(f)ne(e) re(d)quí(dc)es(d.)cit.(d.) (::)" },
  { id: 'modus2', mode: 2, finalis: 'D', tenor: 'F',
    gabc: "(f3) Se(f)cún(e)dus(f) mo(h)dus(h) (,) gra(h)vis(g) est(f) (;) de(e)scén(f)dit(d) in(c) i(e)ma(f.) (:) et(h) qui(g)é(f)scit(e) in(f) re.(f.) (::)" },
  { id: 'modus3', mode: 3, finalis: 'E', tenor: 'C', finalChord: 'a-Moll',
    gabc: "(c4) Tér(e)ti(g)us(h) (,) ca(j)nit(j) al(jk)ta(j) (;) mý(h)sti(j)ce(i) so(h)nans(g.) (:) et(g) in(h) mi(g) fi(g)ní(f)tur.(e.) (::)" },
  { id: 'modus4', mode: 4, finalis: 'E', tenor: 'A', finalChord: 'a-Moll',
    gabc: "(c4) Quar(e)tus(f) hu(g)mi(h)lis(h) (,) non(g) cla(h)mat(g) (;) sed(f) o(g)rat(e.) (:) in(d) si(f)lén(g)ti(f)o.(e.) (::)" },
  { id: 'modus5', mode: 5, finalis: 'F', tenor: 'C',
    gabc: "(c4) Quin(f)tus(h) lae(j)tá(j)tur(j) (,) in(k) al(j)tis(h) (;) ju(ixi)bi(h)lat(g) (:) et(h) ex(j)súl(h)tat(g) gau(gf)dens.(f.) (::)" },
  { id: 'modus6', mode: 6, finalis: 'F', tenor: 'A',
    gabc: "(c4) Sex(f)tus(g) de(h)vó(h)tus(h) (,) pi(g)e(h) (;) psal(f)lit(g) (:) can(f)tat(d) Dó(f)mi(g)no.(f.) (::)" },
  { id: 'modus7', mode: 7, finalis: 'G', tenor: 'D',
    gabc: "(c3) Sép(e)ti(g)mus(i) (,) an(i)gé(i)li(j)cus(i) (;) vo(k)lat(j) sur(i)sum(h) (:) ad(i) ae(h)thé(g)ra(f) cae(g)li.(e.) (::)" },
  { id: 'modus8', mode: 8, finalis: 'G', tenor: 'C', finalChord: 'G-Dur',
    gabc: "(c4) Oc(g)tá(h)vus(j) (,) per(j)féc(j)tus(k) (;) bé(j)at(h) (:) om(j)nes(h) san(g)ctos(f) su(h)os.(g.) (::)" },
  // Rezitation (psalmtonartig): lange Tonwiederholung auf dem Tenor
  { id: 'rezitation8', mode: 8, finalis: 'G', tenor: 'C', recitation: true,
    gabc: "(c4) Re(g)ci(h)tá(j)ti(j)o(j) lon(j)ga(j) in(j) te(j)nó(k)re(j) stat:(j.) (:) et(j) cho(j)rus(j) re(j)spón(j)det(i) i(j)te(jh)rum.(g.) (::)" },
  // Melismatisch, grosser Ambitus in einer Silbe
  { id: 'melisma1', mode: 1, finalis: 'D', tenor: 'A',
    gabc: "(c4) Al(d)le(dfh)lú(hghf)ia.(gfe/fd.) (::)" },
  // b und h im selben Stück (b-Regel)
  { id: 'bh1', mode: 1, finalis: 'D', tenor: 'A',
    gabc: "(c4) Mó(d)dus(h) cum(ixi) be(h) mol(g)li(h) (;) et(h) cum(j) be(i) du(h)ro(g) stat.(f) (:) sem(e)per(f) in(g) de(e) fi(d.)nit.(d.) (::)" },
  // Transposition (Finalis D -> G) und Pedal-unabhängige Akkordwahl
  { id: 'modus1_nach_g', mode: 1, finalis: 'D', tenor: 'A', opts: { targetPc: 7 },
    gabc: "(c4) Tes(d)ti(f)mó(h)ni(h)um(hg) (,) mo(h)di(ixi) pri(h)mi(g) (;) de(f)cán(gh)tat(g) cho(f)rus(e) (:) in(d) fi(f)ne(e) re(d)quí(dc)es(d.)cit.(d.) (::)" },
  // Echtes Material: Schluss der Communio «Tu es Petrus» (Modus VI), Melodie aus dem
  // NOH-Satz Nr. 1163 abgelesen (dort einen Ton höher, Finalis G; cb-Schlüssel = Leiter mit b wie in der NOH-Vorzeichnung). Referenz NOH:
  // … C-Dur | G-Dur⁶ → G-Dur | Quartvorhalt c–h → G-Dur.
  { id: 'tu_es_petrus_schluss', mode: 6, finalis: 'F', tenor: 'A', opts: { targetPc: 7 }, finalChord: 'G-Dur',
    gabc: "(cb4) æ(f)di(fgh)fi(hg)cá(g)bo(fgfd) (,) Ec(d)clé(ffg)si(f)am(fg/hg/hg) me(fg/hgfg)am.(gf..) (::)" },
  // dasselbe mit Pedal (Tenor darf weiter vom Bass entfernt liegen)
  { id: 'modus8_pedal', mode: 8, finalis: 'G', tenor: 'C', opts: { pedal: true }, finalChord: 'G-Dur',
    gabc: "(c4) Oc(g)tá(h)vus(j) (,) per(j)féc(j)tus(k) (;) bé(j)at(h) (:) om(j)nes(h) san(g)ctos(f) su(h)os.(g.) (::)" },
];
