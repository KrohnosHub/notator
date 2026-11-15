// ── Neume visual picker (geometric SVG) ──────────────────────────

const NEUME_DEFS = [
  {val:'punctum',  label:'Punctum',   tones:1},
  {val:'virga',    label:'Virga',     tones:1},
  {val:'quilisma', label:'Quilisma',  tones:1},
  {val:'podatus',  label:'Podatus',   tones:2},
  {val:'clivis',   label:'Clivis',    tones:2},
  {val:'salicus',  label:'Salicus',   tones:3},
  {val:'torculus', label:'Torculus',  tones:3},
  {val:'porrectus',label:'Porrectus', tones:3},
  {val:'scandicus',label:'Scandicus', tones:3},
  {val:'climacus',   label:'Climacus',   tones:3},
  {val:'bistropha',  label:'Bistropha',  tones:1},
  {val:'tristropha', label:'Tristropha', tones:1},
  // Extended types (recognised by exsurge, now also manually enterable)
  {val:'apostropha',         label:'Apostropha',    tones:1},
  {val:'distropha',          label:'Distropha',     tones:1},
  {val:'bivirga',            label:'Bivirga',       tones:1},
  {val:'trivirga',           label:'Trivirga',      tones:1},
  {val:'puncta_inclinata',   label:'P.Inclinata',   tones:3},
  {val:'pes_subpunctis',     label:'PesSubpunct.',  tones:4},
  {val:'pes_quassus',        label:'PesQuassus',    tones:2},
  {val:'torculus_resupinus', label:'Torculus Res.', tones:4},
  {val:'porrectus_flexus',   label:'Porrect.Flex.', tones:4},
  {val:'scandicus_flexus',   label:'Scand.Flex.',   tones:4},
];

const NEUME_SVG_ICONS = {
  punctum: `<svg viewBox="16.5 16.0 24.0 16.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Punctum" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="5" ></use></g></g></g></svg>`,
  virga: `<svg viewBox="16.5 13.0 24.0 26.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Virga" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="5" ></use><rect x="4" y="5" width="1" height="13.5" fill="currentColor" class="neumeLine" ></rect></g></g></g></svg>`,
  quilisma: `<svg viewBox="16.5 21.0 24.0 16.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="Quilisma" class="glyph" transform="scale(0.05)" ><path d="M-50 34.938V-51c5.73 20.833 13.02 31.25 21.875 31.25 7.813 0 12.5-15.625 14.063-46.875 3.645 12.5 6.9 21.224 9.765 26.172s6.9 7.422 12.11 7.422c5.208 0 9.374-14.324 12.5-42.97 5.73 22.917 10.677 34.375 14.843 34.375 5.73 0 10.677-15.885 14.844-47.656v100c0 17.707-3.125 26.56-9.375 26.56-4.688 0-9.115-5.988-13.28-17.968-2.085 21.875-8.074 32.813-17.97 32.813-7.813 0-16.146-7.292-25-21.875-4.688 20.312-10.677 30.47-17.97 30.47-5.207 0-9.244-2.605-12.108-7.814C-48.568 47.698-50 41.708-50 34.938z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Punctum" transform="translate(17.5,0)" ><use xlink:href="#Quilisma" x="2.5" y="10" ></use></g></g></g></svg>`,
  podatus: `<svg viewBox="16.5 11.0 24.0 21.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PodatusLower" class="glyph" transform="scale(0.05)" ><path d="M-4.688-30.28c22.396 0 34.636-.262 36.72-.782 5.728-1.563 8.593-5.21 8.593-10.938H50v97.656c0 2.604-1.302 4.167-3.906 4.688-5.21.52-21.355.78-48.438.78-23.958 0-38.54-.26-43.75-.78-2.604 0-3.906-1.302-3.906-3.906v-82.032c0-3.646 1.302-5.468 3.906-5.468h2.344c2.604.52 15.625.78 39.063.78z"/></g><g id="PodatusUpper" class="glyph" transform="scale(0.05)" ><path d="M-46.094-63.78c13.542 0 24.61 2.473 33.203 7.42C-4.298-51.41 0-43.99 0-34.093V62h-9.375c0-10.938-2.604-19.14-7.812-24.61-5.21-5.468-14.844-8.203-28.907-8.202-18.23 0-33.333 4.166-45.312 12.5v-75.782c0-19.79 15.104-29.687 45.312-29.687z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Podatus" transform="translate(17.5,0)" ><use xlink:href="#PodatusLower" x="2.5" y="5" ></use><use xlink:href="#PodatusUpper" x="5" y="0" ></use></g></g></g></svg>`,
  clivis: `<svg viewBox="16.5 11.0 24.0 21.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Clivis" transform="translate(17.5,0)" ><rect x="0" y="0" width="1" height="7.805408997969193" fill="currentColor" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="2.5" y="0" ></use><use xlink:href="#PunctumQuadratum" x="7.5" y="5" ></use></g></g></g></svg>`,
  salicus: `<svg viewBox="16.5 6.0 28.5 26.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g><g id="OriscusAsc" class="glyph" transform="scale(0.05)" ><path d="M50 30.25c0 12.5-3.125 21.354-9.375 26.562-3.125 2.605-7.813 3.907-14.063 3.907-3.125 0-5.99-.522-8.593-1.564-2.605-1.04-5.6-2.474-8.986-4.297C5.6 53.035 2.734 51.603.39 50.56c-2.343-1.04-5.338-2.474-8.984-4.296-3.646-1.823-6.77-3.256-9.375-4.297-2.603-1.043-5.468-1.564-8.593-1.564-6.25 0-10.937 1.563-14.062 4.688C-46.875 50.824-50 59.677-50 71.656v-106.25c0-13.02 3.125-21.875 9.375-26.562 3.125-2.604 7.813-3.906 14.063-3.907 3.125 0 5.99.52 8.593 1.563 2.605 1.042 5.73 2.474 9.376 4.297 3.646 1.823 6.51 2.995 8.594 3.516l10.938 5.468c6.25 3.126 11.458 4.69 15.624 4.69 6.25 0 10.938-1.564 14.063-4.69C46.875-55.426 50-64.02 50-76V30.25z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="44.0" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="44.0" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Salicus" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="5" ></use><use xlink:href="#OriscusAsc" x="9" y="0" ></use><use xlink:href="#PunctumQuadratum" x="15.5" y="-5" ></use><rect x="17" y="-5" width="1" height="13.5" fill="currentColor" class="neumeLine" ></rect></g></g></g></svg>`,
  torculus: `<svg viewBox="16.5 11.0 28.5 21.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="44.0" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="44.0" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Torculus" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="5" ></use><use xlink:href="#PunctumQuadratum" x="7.5" y="0" ></use><use xlink:href="#PunctumQuadratum" x="12.5" y="5" ></use></g></g></g></svg>`,
  porrectus: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 3.0 38.0 40.0" width="56" height="38" style="display:block" ><g ><defs ><g id="Porrectus2" class="glyph" transform="scale(0.0625)" ><path d="M309.375 259.375c-50.52 0-110.938-22.396-181.25-67.188C48.437 141.667-10.938 94.272-50 50V-68.75C0-3.125 60.417 52.083 131.25 96.875c58.333 36.98 110.677 58.854 157.03 65.625h7.033c16.145 0 26.822-9.896 32.03-29.688v114.844c0 7.812-5.99 11.72-17.968 11.72z"/></g><g id="None" class="glyph" transform="scale(0.0625)" ><g></g></g><g id="PodatusUpper" class="glyph" transform="scale(0.0625)" ><path d="M-46.094-63.78c13.542 0 24.61 2.473 33.203 7.42C-4.298-51.41 0-43.99 0-34.093V62h-9.375c0-10.938-2.604-19.14-7.812-24.61-5.21-5.468-14.844-8.203-28.907-8.202-18.23 0-33.333 4.166-45.312 12.5v-75.782c0-19.79 15.104-29.687 45.312-29.687z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Porrectus" transform="translate(18.75,0)" ><rect x="0" y="6.25" width="1" height="16.00676124746149" fill="#000" class="neumeLine" ></rect><use xlink:href="#Porrectus2" x="3.125" y="6.25" ></use><use xlink:href="#None" x="23.58393669128418" y="18.75" ></use><use xlink:href="#PodatusUpper" x="23.58393669128418" y="12.5" ></use><text x="-0.125" y="30.461000442504883" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  scandicus: `<svg viewBox="16.5 6.0 26.0 26.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g><g id="PodatusLower" class="glyph" transform="scale(0.05)" ><path d="M-4.688-30.28c22.396 0 34.636-.262 36.72-.782 5.728-1.563 8.593-5.21 8.593-10.938H50v97.656c0 2.604-1.302 4.167-3.906 4.688-5.21.52-21.355.78-48.438.78-23.958 0-38.54-.26-43.75-.78-2.604 0-3.906-1.302-3.906-3.906v-82.032c0-3.646 1.302-5.468 3.906-5.468h2.344c2.604.52 15.625.78 39.063.78z"/></g><g id="PodatusUpper" class="glyph" transform="scale(0.05)" ><path d="M-46.094-63.78c13.542 0 24.61 2.473 33.203 7.42C-4.298-51.41 0-43.99 0-34.093V62h-9.375c0-10.938-2.604-19.14-7.812-24.61-5.21-5.468-14.844-8.203-28.907-8.202-18.23 0-33.333 4.166-45.312 12.5v-75.782c0-19.79 15.104-29.687 45.312-29.687z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="41.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="41.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Scandicus" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="5" ></use><use xlink:href="#PodatusLower" x="7.5" y="0" ></use><use xlink:href="#PodatusUpper" x="10" y="-4.999999999999999" ></use></g></g></g></svg>`,
  climacus: `<svg viewBox="16.5 6.0 28.1 26.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.05)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g><g id="PunctumInclinatum" class="glyph" transform="scale(0.05)" ><path d="M0-75.78L50 0 0 75-50 0 0-75.78z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="43.6" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="43.6" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Climacus" transform="translate(17.5,0)" ><use xlink:href="#PunctumQuadratum" x="2.5" y="-5" ></use><rect x="4" y="-5" width="1" height="13.5" fill="currentColor" class="neumeLine" ></rect><use xlink:href="#PunctumInclinatum" x="8.0625" y="0" ></use><use xlink:href="#PunctumInclinatum" x="12.0625" y="5" ></use></g></g></g></svg>`,
  bistropha: `<svg viewBox="16.5 11.0 24.0 21.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="Stropha" class="glyph" transform="scale(0.05)" ><path d="M1.22-73.438c4.165 13.02 12.238 27.084 24.217 42.188L49.657 0 34.812 27.344C18.666 55.47-.084 72.396-21.438 78.124c4.687-3.645 7.03-8.593 7.03-14.843 0-8.853-4.947-20.572-14.843-35.155L-48 0 1.22-73.438z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="39.5" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="39.5" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement _Apostropha" transform="translate(17.5,0)" ><use xlink:href="#Stropha" x="2.4000000000000004" y="5" ></use></g><g class="ChantNotationElement _Apostropha" transform="translate(25.507849884033202,0)" ><use xlink:href="#Stropha" x="2.4000000000000004" y="0" ></use></g></g></g></svg>`,
  tristropha: `<svg viewBox="16.5 11.0 26.4 21.0" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink"  width="56" height="38" style="display:block"><g ><defs ><g id="Stropha" class="glyph" transform="scale(0.05)" ><path d="M1.22-73.438c4.165 13.02 12.238 27.084 24.217 42.188L49.657 0 34.812 27.344C18.666 55.47-.084 72.396-21.438 78.124c4.687-3.645 7.03-8.593 7.03-14.843 0-8.853-4.947-20.572-14.843-35.155L-48 0 1.22-73.438z"/></g></defs><g class="chantLine" transform="translate(0,23.24380035400391)" ><line x1="16.5" y1="-5" x2="41.9" y2="-5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><line x1="16.5" y1="5" x2="41.9" y2="5" stroke="currentColor" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement _Apostropha" transform="translate(17.5,0)" ><use xlink:href="#Stropha" x="2.4000000000000004" y="5" ></use></g><g class="ChantNotationElement Distropha" transform="translate(25.507849884033202,0)" ><use xlink:href="#Stropha" x="2.4000000000000004" y="0" ></use><use xlink:href="#Stropha" x="10.407849884033203" y="0" ></use></g></g></g></svg>`,
  apostropha: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 16.0" width="56" height="38" style="display:block" ><g ><defs ><g id="Stropha" class="glyph" transform="scale(0.0625)" ><path d="M1.22-73.438c4.165 13.02 12.238 27.084 24.217 42.188L49.657 0 34.812 27.344C18.666 55.47-.084 72.396-21.438 78.124c4.687-3.645 7.03-8.593 7.03-14.843 0-8.853-4.947-20.572-14.843-35.155L-48 0 1.22-73.438z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement _Apostropha" transform="translate(18.75,0)" ><use xlink:href="#Stropha" x="3" y="-6.25" ></use><text x="-0.25" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  distropha: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 16.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Distropha" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="-6.25" ></use><use xlink:href="#PunctumQuadratum" x="12.5" y="-6.25" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  bivirga: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 16.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Bivirga" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="-6.25" ></use><rect x="5.25" y="-6.25" width="1" height="16.875" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="11.5" y="-6.25" ></use><rect x="13.625" y="-6.25" width="1" height="16.875" fill="#000" class="neumeLine" ></rect><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  trivirga: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 16.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Trivirga" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="-6.25" ></use><rect x="5.25" y="-6.25" width="1" height="16.875" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="11.5" y="-6.25" ></use><rect x="13.625" y="-6.25" width="1" height="16.875" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="19.875" y="-6.25" ></use><rect x="22" y="-6.25" width="1" height="16.875" fill="#000" class="neumeLine" ></rect><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  puncta_inclinata: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 35.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumInclinatum" class="glyph" transform="scale(0.0625)" ><path d="M0-75.78L50 0 0 75-50 0 0-75.78z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement PunctaInclinata" transform="translate(18.75,0)" ><use xlink:href="#PunctumInclinatum" x="4.9375" y="-6.25" ></use><use xlink:href="#PunctumInclinatum" x="9.9375" y="0" ></use><use xlink:href="#PunctumInclinatum" x="14.9375" y="6.25" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  pes_subpunctis: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 35.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g><g id="PodatusLower" class="glyph" transform="scale(0.0625)" ><path d="M-4.688-30.28c22.396 0 34.636-.262 36.72-.782 5.728-1.563 8.593-5.21 8.593-10.938H50v97.656c0 2.604-1.302 4.167-3.906 4.688-5.21.52-21.355.78-48.438.78-23.958 0-38.54-.26-43.75-.78-2.604 0-3.906-1.302-3.906-3.906v-82.032c0-3.646 1.302-5.468 3.906-5.468h2.344c2.604.52 15.625.78 39.063.78z"/></g><g id="PodatusUpper" class="glyph" transform="scale(0.0625)" ><path d="M-46.094-63.78c13.542 0 24.61 2.473 33.203 7.42C-4.298-51.41 0-43.99 0-34.093V62h-9.375c0-10.938-2.604-19.14-7.812-24.61-5.21-5.468-14.844-8.203-28.907-8.202-18.23 0-33.333 4.166-45.312 12.5v-75.782c0-19.79 15.104-29.687 45.312-29.687z"/></g><g id="PunctumInclinatum" class="glyph" transform="scale(0.0625)" ><path d="M0-75.78L50 0 0 75-50 0 0-75.78z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Scandicus" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="12.5" ></use><use xlink:href="#PodatusLower" x="9.375" y="6.25" ></use><use xlink:href="#PodatusUpper" x="12.5" y="0" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g><g class="ChantNotationElement PunctaInclinata" transform="translate(34.375,0)" ><use xlink:href="#PunctumInclinatum" x="3.125" y="12.5" ></use></g></g></g></svg>`,
  pes_quassus: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 28.0" width="56" height="38" style="display:block" ><g ><defs ><g id="OriscusDes" class="glyph" transform="scale(0.0625)" ><path d="M-50 30.844v-106.25c0 11.458 3.125 20.052 9.375 25.78 3.125 3.126 7.813 4.69 14.063 4.688 4.687 0 13.41-3.255 26.17-9.765 12.762-6.51 21.746-9.766 26.954-9.766 6.25 0 10.938 1.303 14.063 3.907C46.875-55.874 50-47.02 50-34V72.25c0-11.98-3.125-20.833-9.375-26.563C37.5 42.563 32.812 41 26.562 41 21.875 41 13.023 44.385 0 51.156c-4.167 2.604-8.594 4.948-13.28 7.032-4.69 2.083-9.116 3.124-13.283 3.124-6.25 0-10.937-1.302-14.062-3.906C-46.875 52.198-50 43.344-50 30.844z"/></g><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Clivis" transform="translate(18.75,0)" ><use xlink:href="#OriscusDes" x="3.125" y="-6.25" ></use><rect x="5.25" y="-6.25" width="1" height="12.5" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="8.375" y="6.25" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  torculus_resupinus: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 44.0 28.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g><g id="Porrectus2" class="glyph" transform="scale(0.0625)" ><path d="M309.375 259.375c-50.52 0-110.938-22.396-181.25-67.188C48.437 141.667-10.938 94.272-50 50V-68.75C0-3.125 60.417 52.083 131.25 96.875c58.333 36.98 110.677 58.854 157.03 65.625h7.033c16.145 0 26.822-9.896 32.03-29.688v114.844c0 7.812-5.99 11.72-17.968 11.72z"/></g><g id="None" class="glyph" transform="scale(0.0625)" ><g></g></g><g id="PodatusUpper" class="glyph" transform="scale(0.0625)" ><path d="M-46.094-63.78c13.542 0 24.61 2.473 33.203 7.42C-4.298-51.41 0-43.99 0-34.093V62h-9.375c0-10.938-2.604-19.14-7.812-24.61-5.21-5.468-14.844-8.203-28.907-8.202-18.23 0-33.333 4.166-45.312 12.5v-75.782c0-19.79 15.104-29.687 45.312-29.687z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement TorculusResupinus" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="6.25" ></use><rect x="5.25" y="-6.25" width="1" height="12.5" fill="#000" class="neumeLine" ></rect><use xlink:href="#Porrectus2" x="8.375" y="-6.25" ></use><use xlink:href="#None" x="28.83393669128418" y="6.25" ></use><use xlink:href="#PodatusUpper" x="28.83393669128418" y="0" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g></g></g></svg>`,
  porrectus_flexus: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 -2.0 31.5 42.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Clivis" transform="translate(18.75,0)" ><rect x="0" y="-12.5" width="1" height="9.756761247461492" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="3.125" y="-12.5" ></use><use xlink:href="#PunctumQuadratum" x="9.375" y="-6.25" ></use><text x="-0.125" y="30.25676124746149" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g><g class="ChantNotationElement Clivis" transform="translate(34.375,0)" ><rect x="0" y="6.25" width="1" height="16.00676124746149" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="3.125" y="6.25" ></use><use xlink:href="#PunctumQuadratum" x="9.375" y="12.5" ></use></g></g></g></svg>`,
  scandicus_flexus: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" class="ChantScore" viewBox="16.5 5.0 31.5 35.0" width="56" height="38" style="display:block" ><g ><defs ><g id="PunctumQuadratum" class="glyph" transform="scale(0.0625)" ><path d="M0-60.906c33.333 0 50 9.635 50 28.906v94.53C39.062 51.595 22.396 46.126 0 46.126s-39.063 5.47-50 16.406V-32c0-19.27 16.667-28.906 50-28.906z"/></g></defs><g class="chantLine" transform="translate(0,19.375)" ><line x1="0" y1="-18.75" x2="120" y2="-18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="-6.25" x2="120" y2="-6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="6.25" x2="120" y2="6.25" stroke="#000" stroke-width="1" class="staffLine" ></line><line x1="0" y1="18.75" x2="120" y2="18.75" stroke="#000" stroke-width="1" class="staffLine" ></line><g class="ChantNotationElement Torculus" transform="translate(18.75,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="6.25" ></use><rect x="5.25" y="-6.25" width="1" height="12.5" fill="#000" class="neumeLine" ></rect><use xlink:href="#PunctumQuadratum" x="8.375" y="-6.25" ></use><use xlink:href="#PunctumQuadratum" x="14.625" y="0" ></use><text x="-0.125" y="27.375" class="lyric" text-anchor="start" dominant-baseline="baseline" style="font-family:'Palatino Linotype', 'Book Antiqua', Palatino, serif;font-size:16px;font-kerning:normal;" ><tspan >x</tspan></text></g><g class="ChantNotationElement Punctum" transform="translate(39.625,0)" ><use xlink:href="#PunctumQuadratum" x="3.125" y="12.5" ></use></g></g></g></svg>`,

};

// The prerendered NEUME_SVG_ICONS strings each carry their own <defs><g id="...">
// glyph symbols (e.g. "PunctumQuadratum"), baked in at a FIXED small scale for
// the palette preview. Multiple icons — and the main chant renderer itself —
// reuse the SAME glyph names. Since `id` must be unique across the whole HTML
// document (xlink:href="#id" resolves document-wide, not scoped to one <svg>
// root), inserting several of these icons unmodified made every <use> of that
// id anywhere on the page — including in the live, dynamically-scaled chant
// notation — resolve to whichever same-named <defs> happened to appear FIRST
// in the DOM (a palette icon, permanently fixed at its tiny preview scale).
// That's why plain punctum-based note heads (used by many neume types) stayed
// visually stuck at a tiny size regardless of the "Neumen" slider, while
// glyphs with no palette-icon counterpart (clef, accidentals) scaled fine.
// Fix: give each icon's internal ids a unique prefix so they can never
// collide with each other or with the main render.
function gregNamespaceSvgIds(svgStr, prefix) {
  const ids = new Set();
  svgStr.replace(/\sid="([^"]+)"/g, (m, id) => { ids.add(id); return m; });
  if (ids.size === 0) return svgStr;
  let out = svgStr;
  ids.forEach(id => {
    const safeId = prefix + '-' + id;
    out = out.split('id="' + id + '"').join('id="' + safeId + '"');
    out = out.split('href="#' + id + '"').join('href="#' + safeId + '"');
  });
  return out;
}

function gregBuildNeumeGrid() {
  const grid = document.getElementById('greg-neume-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const curVal = (document.getElementById('greg-neume-sel')||{value:'punctum'}).value;
  NEUME_DEFS.forEach(function(nd) {
    const isOn = nd.val === curVal;
    const btn = document.createElement('button');
    btn.className = 'b' + (isOn ? ' on' : '');
    btn.title = nd.label + ' (' + (NEUME_OPEN_ENDED.includes(nd.val)?'mind. ':'') + nd.tones + ' Ton' + (nd.tones>1?'e':'') + ')';
    btn.style.cssText = 'padding:1px 0;width:45px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:1px;height:51px;overflow:hidden;color:'+(isOn?'#e0d4b0':'#6b8a60');
    // Icon: use prerendered SVG
    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'width:45px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden';
    const svgIcon = NEUME_SVG_ICONS[nd.val];
    iconDiv.innerHTML = svgIcon ? gregNamespaceSvgIds(svgIcon, 'nicon-' + nd.val) : '<span style="font-size:8px;color:#3a4a30">?</span>';
    // Scale SVG to fit container
    const svgEl = iconDiv.querySelector('svg');
    if (svgEl) { svgEl.style.width='45px'; svgEl.style.height='auto'; }
    const lbl = document.createElement('span');
    lbl.textContent = nd.label;
    lbl.style.cssText = 'font-size:7px;color:'+(isOn?'#e0d4b0':'#6b8a60')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:45px;max-width:45px;display:block;line-height:1.1;flex-shrink:0;text-align:center';
    btn.appendChild(iconDiv);
    btn.appendChild(lbl);
    btn.onclick = function() { gregSelectNeume(nd.val); };
    grid.appendChild(btn);
  });
  const hint = document.getElementById('greg-neume-hint');
  const nd = NEUME_DEFS.find(n=>n.val===curVal)||NEUME_DEFS[0];
  const descNeumes = ['clivis','porrectus','climacus','puncta_inclinata','porrectus_flexus'];
  const orderHint = descNeumes.includes(curVal) ? ' (höchste Note zuerst!)' : '';
  if (hint) hint.textContent = '→ '+gregToneHintText(nd)+orderHint;
  gregQuickbarSync();
}
// Neume wählen (Raster links, Werkzeugleiste, Tastenkürzel)
function gregSelectNeume(val) {
  const nd = NEUME_DEFS.find(n => n.val === val); if (!nd) return;
  const sel = document.getElementById('greg-neume-sel');
  if (sel) sel.value = val;
  _gregPending = null;
  const hint = document.getElementById('greg-neume-hint');
  if (hint) hint.textContent = '→ '+gregToneHintText(nd);
  gregUpdateQuilismaUI();
  gregUpdateEpisemaUI();
  gregUpdateMoraUI();
  gregBuildNeumeGrid();
  gregGst('Neume: ' + nd.label + ' – ' + gregToneHintText(nd));
}
// Silbe mit Leerzeichen am Ende -> Wortende anhaken (und wieder weg, wenn
// das Leerzeichen gelöscht wird und das Häkchen nur deshalb gesetzt war)
function gregSylSpaceWordEnd(v) {
  const lw = document.getElementById('greg-wordend'); if (!lw) return;
  const sp = /\S\s$/.test(v || '');
  if (sp && !lw.checked) { lw.checked = true; lw._auto = true; }
  else if (!sp && lw.checked && lw._auto) { lw.checked = false; lw._auto = false; }
  const qw = document.getElementById('greg-qb-we'); if (qw) qw.checked = lw.checked;
}
// Spiegel der Seitenleiste in der Werkzeugleiste: data-m = Feld links (Wert/Haken),
// data-mshow = Element links, dessen Sichtbarkeit übernommen wird
function gregQbMirror() {
  const qb = document.getElementById('greg-quickbar'); if (!qb) return;
  if (!qb._mirrorInit) {
    qb._mirrorInit = true;
    qb.querySelectorAll('[data-m]').forEach(el => el.addEventListener('change', () => {
      const src = document.getElementById(el.dataset.m); if (!src) return;
      if (el.type === 'checkbox') src.checked = el.checked; else src.value = el.value;
      src.dispatchEvent(new Event('change', { bubbles: true }));
      gregQuickbarSync();
    }));
    // Änderungen links (Haken, Sichtbarkeit, Fertig-Knopf) sofort oben nachführen
    const panel = document.getElementById('greg-input-panel');
    if (panel && window.MutationObserver) {
      let t = 0; const later = () => { if (!t) t = requestAnimationFrame(() => { t = 0; gregQbMirror(); }); };
      new MutationObserver(later).observe(panel, { attributes: true, subtree: true, attributeFilter: ['style', 'disabled'] });
      panel.addEventListener('change', later);
    }
    try { if (localStorage.getItem('notatorQbExtra') === '1') document.getElementById('greg-qb-extra').style.display = 'flex'; } catch (e) {}
  }
  qb.querySelectorAll('[data-m]').forEach(el => {
    const src = document.getElementById(el.dataset.m); if (!src || document.activeElement === el) return;
    if (el.type === 'checkbox') { el.checked = src.checked; el.disabled = src.disabled; }
    else el.value = src.value;
  });
  qb.querySelectorAll('[data-mshow]').forEach(el => {
    const src = document.getElementById(el.dataset.mshow); if (!src) return;
    el.style.display = (src.style.display === 'none' || getComputedStyle(src).display === 'none') ? 'none' : '';
  });
  const mb = document.getElementById('greg-qb-more-btn'), ex = document.getElementById('greg-qb-extra');
  if (mb && ex) mb.textContent = ex.style.display === 'none' ? 'mehr ▾' : 'weniger ▴';
}
// PC (ab 701 px): Werkzeugleiste in beschriftete Gruppen umordnen (Elemente mit data-dg);
// Handy: ursprüngliche Anordnung (Platzhalter merken die alte Stelle).
const GREG_QB_ROWS = [[['u', ''], ['n', 'Neume'], ['s', 'Silbe'], ['z', 'Zeichen']], [['t', 'Trennung / Text'], ['k', 'Struktur'], ['e', '']]];
function gregQbLayout() {
  const qb = document.getElementById('greg-quickbar'); if (!qb) return;
  const desk = !gregIsMobileViewport();
  if (desk === !!qb._deskLayout) return;
  if (desk) {
    const els = Array.from(qb.querySelectorAll('[data-dg]'));
    qb._dgHome = els.map(el => { const ph = document.createComment('dg'); el.parentNode.insertBefore(ph, el); return [el, ph]; });
    const groups = {};
    const rows = GREG_QB_ROWS.map(row => {
      const rw = document.createElement('div'); rw.className = 'qb-row';
      row.forEach(([k, l]) => { const g = document.createElement('span'); g.className = 'qb-g' + (l ? '' : ' qb-g-plain'); if (l) g.dataset.l = l; groups[k] = g; rw.appendChild(g); });
      return rw;
    });
    els.sort((a, b) => a.dataset.dg.localeCompare(b.dataset.dg)).forEach(el => { const g = groups[el.dataset.dg[0]]; if (g) g.appendChild(el); });
    qb.insertBefore(rows[1], qb.firstChild); qb.insertBefore(rows[0], qb.firstChild);
    qb._dgRows = rows;
  } else {
    (qb._dgHome || []).forEach(([el, ph]) => { if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.remove(); } });
    (qb._dgRows || []).forEach(rw => rw.remove());
    qb._dgHome = qb._dgRows = null;
  }
  qb._deskLayout = desk;
  qb.classList.toggle('qb-desk-layout', desk);
}
window.addEventListener('resize', () => { try { gregQbLayout(); } catch (e) {} });
document.addEventListener('DOMContentLoaded', () => { try { gregQbLayout(); } catch (e) { console.warn(e); } });
// ⚙ Einstellungen in der Kopfleiste (PC): Bildschirm wach halten, Silbe abfragen
function ntSettingsMenu(btn) {
  const old = document.getElementById('nt-set-pop'); if (old) { old.remove(); if (old._btn === btn) return; }
  const src = btn.getAttribute('data-src');
  const d = document.createElement('div'); d.id = 'nt-set-pop'; d._btn = btn;
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:8px 10px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:#c0d890;display:flex;flex-direction:column;gap:7px;min-width:240px';
  const rc = btn.getBoundingClientRect();
  d.style.top = (rc.bottom + 4) + 'px';
  const opt = (label, on, fn, tip) => { const l = document.createElement('label'); l.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer'; if (tip) l.title = tip; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!on; c.style.accentColor = '#5a8a40'; c.onchange = () => fn(c.checked); l.appendChild(c); l.appendChild(document.createTextNode(label)); d.appendChild(l); };
  opt('Bildschirm wach halten', ntWakePref(), v => { if (!!ntWakePref() !== v) ntWakeToggle(); }, 'Verhindert, dass der Bildschirm beim Singen/Spielen dunkel wird');
  if (src === 'greg') opt('Silbe nach dem Setzen abfragen', gregAskSylOn(), v => gregAskSylSet(v), 'Nach dem Setzen einer Neume ohne Silbe erscheint unter der Note ein Feld für die Silbe');
  document.body.appendChild(d);
  d.style.left = Math.max(8, Math.min(rc.left, window.innerWidth - d.offsetWidth - 8)) + 'px';
  const close = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
function gregQbExtraToggle() {
  const ex = document.getElementById('greg-qb-extra'); if (!ex) return;
  const on = ex.style.display === 'none';
  ex.style.display = on ? 'flex' : 'none';
  try { localStorage.setItem('notatorQbExtra', on ? '1' : '0'); } catch (e) {}
  gregQbMirror();
}
// «weitere Neumen»: Auswahl mit Bild statt einfacher Liste
function gregQbMoreNeumes(btn) {
  const old = document.getElementById('greg-qb-more-pop'); if (old) { old.remove(); return; }
  const cur = (document.getElementById('greg-neume-sel') || {}).value;
  const d = document.createElement('div'); d.id = 'greg-qb-more-pop';
  d.style.cssText = 'position:fixed;z-index:1600;background:#1a2414;border:1px solid #5a8a40;border-radius:5px;padding:6px;box-shadow:0 4px 16px rgba(0,0,0,.5);display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:4px;width:min(440px,calc(100vw - 16px));box-sizing:border-box;max-height:70vh;overflow-y:auto';
  NEUME_DEFS.filter(n => GREG_QB_NEUMES.indexOf(n.val) < 0).forEach(nd => {
    const b = document.createElement('button'); b.className = 'b';
    b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px 2px;height:auto;white-space:normal;font-size:11px;line-height:1.1' + (nd.val === cur ? ';outline:3px solid #d0a040' : '');
    const ic = NEUME_SVG_ICONS[nd.val];
    b.innerHTML = '<span style="width:52px;height:40px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f6f0dc;border-radius:3px">' + (ic ? gregNamespaceSvgIds(ic, 'qbm-' + nd.val) : '') + '</span><span>' + nd.label + '</span>';
    const sv = b.querySelector('svg'); if (sv) { sv.style.width = '52px'; sv.style.height = 'auto'; }
    b.onclick = () => { d.remove(); gregSelectNeume(nd.val); };
    d.appendChild(b);
  });
  document.body.appendChild(d);
  const r = btn.getBoundingClientRect();
  d.style.top = Math.min(r.bottom + 4, window.innerHeight - d.offsetHeight - 8) + 'px';
  d.style.left = Math.max(8, Math.min(r.left, window.innerWidth - d.offsetWidth - 8)) + 'px';
  const close = e => { if (!d.contains(e.target) && e.target !== btn) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
// Werkzeugleiste über dem Notenblatt (PC/Tablet)
const GREG_QB_NEUMES = ['punctum','virga','podatus','clivis','torculus','porrectus','scandicus','climacus','quilisma'];
const GREG_KEY_NEUMES = { '1':'punctum', '2':'virga', '3':'quilisma', 'p':'podatus', 'c':'clivis', 't':'torculus', 'r':'porrectus', 's':'scandicus', 'k':'climacus', 'l':'salicus', 'i':'puncta_inclinata' };
function gregQuickbarSync() {
  const box = document.getElementById('greg-qb-neumes'); if (!box) return;
  const cur = (document.getElementById('greg-neume-sel') || {value:'punctum'}).value;
  if (!box._built) {
    box._built = true;
    const keyOf = v => Object.keys(GREG_KEY_NEUMES).find(k => GREG_KEY_NEUMES[k] === v);
    GREG_QB_NEUMES.forEach(v => {
      const nd = NEUME_DEFS.find(n => n.val === v); if (!nd) return;
      const b = document.createElement('button'); b.className = 'qb-neu'; b.dataset.val = v;
      b.title = nd.label + (keyOf(v) ? ' (Taste ' + keyOf(v).toUpperCase() + ')' : '');
      const ic = NEUME_SVG_ICONS[v]; b.innerHTML = ic ? gregNamespaceSvgIds(ic, 'qbicon-' + v) : nd.label.slice(0, 3);
      b.onclick = () => gregSelectNeume(v);
      box.appendChild(b);
    });

    const qs = document.getElementById('greg-qb-syl'), ls = document.getElementById('greg-syllable');
    if (qs && ls) { qs.addEventListener('input', () => { ls.value = qs.value; }); ls.addEventListener('input', () => { qs.value = ls.value; }); }
    const qw = document.getElementById('greg-qb-we'), lw = document.getElementById('greg-wordend');
    if (qw && lw) { qw.addEventListener('change', () => { lw.checked = qw.checked; }); lw.addEventListener('change', () => { qw.checked = lw.checked; }); }
    const qa = document.getElementById('greg-qb-ask'); if (qa) qa.checked = gregAskSylOn();
    document.querySelectorAll('#greg-qb-mora input').forEach(cb => {
      const lm = document.getElementById('greg-mora-n' + cb.dataset.p);
      cb.addEventListener('change', () => { if (lm) lm.checked = cb.checked; });
      if (lm) lm.addEventListener('change', () => gregQuickbarSync());
    });
    // Leerzeichen am Ende der Silbe = Wortende (Häkchen wird sichtbar gesetzt)
    [qs, ls].forEach(f => f && f.addEventListener('input', () => gregSylSpaceWordEnd(f.value)));
  }
  document.querySelectorAll('#greg-qb-mora input').forEach(cb => {
    const lm = document.getElementById('greg-mora-n' + cb.dataset.p);
    if (lm) { cb.checked = lm.checked; cb.disabled = lm.disabled; cb.parentElement.style.opacity = lm.disabled ? '0.35' : '1'; }
  });
  gregQbMirror();
  box.querySelectorAll('.qb-neu').forEach(b => b.classList.toggle('on', b.dataset.val === cur));
  const more = document.getElementById('greg-qb-more');
  if (more) { const nd = GREG_QB_NEUMES.indexOf(cur) < 0 ? NEUME_DEFS.find(n => n.val === cur) : null; more.textContent = nd ? nd.label + ' ▾' : 'weitere Neumen ▾'; more.classList.toggle('on', !!nd); }
  const qs = document.getElementById('greg-qb-syl'), ls = document.getElementById('greg-syllable'); if (qs && ls && document.activeElement !== qs) qs.value = ls.value;
  const qw = document.getElementById('greg-qb-we'), lw = document.getElementById('greg-wordend'); if (qw && lw) qw.checked = lw.checked;
}

// Shared "N Klicks auf Notenlinie" hint text, aware of NEUME_OPEN_ENDED
// (Climacus): its tones value (3) is only the minimum, so the hint makes
// clear that further clicks keep adding notes.
function gregToneHintText(nd) {
  if (NEUME_OPEN_ENDED.includes(nd.val)) {
    return 'mind. ' + nd.tones + ' Klicks auf Notenlinie (beliebig mehr möglich, dann Enter/"Fertig")';
  }
  return nd.tones + (nd.tones===1?' Klick':' Klicks') + ' auf Notenlinie';
}

// ── Accidentals ──────────────────────────────────────────────────
let _gregAccidental = null; // 'y', '#', 'n' — applied to next note then cleared

function gregSetAccidental(acc) {
  // Ist gerade ein Eintrag zum Bearbeiten geöffnet, wirkt der Knopf auf
  // diesen Eintrag (Feld "Vorz:") statt auf die nächste neue Note.
  const editAcc = document.getElementById('greg-edit-acc');
  if (editAcc && editAcc.isConnected) {
    editAcc.value = (editAcc.value === acc) ? '' : acc;
    editAcc.dispatchEvent(new Event('change', { bubbles: true }));
    editAcc.style.outline = '2px solid #c09a30';
    setTimeout(() => { editAcc.style.outline = 'none'; }, 900);
    const lbl = {'x':'b\u266D','#':'\u266F','y':'\u266E'}[editAcc.value];
    gregGst(lbl ? 'Vorzeichen ' + lbl + ' im bearbeiteten Eintrag gesetzt – mit ✓ übernehmen' : 'Vorzeichen im bearbeiteten Eintrag entfernt – mit ✓ übernehmen');
    return;
  }
  _gregAccidental = (_gregAccidental === acc) ? null : acc; // toggle
  { const ap = document.getElementById('greg-acc-pos'); if (ap) ap.style.display = _gregAccidental ? '' : 'none'; }
  // GABC native: 'x'=flat(b♭), '#'=sharp(♯), 'y'=natural(♮)
  const labels = {'x':'b\u266D','#':'\u266F','y':'\u266E'};
  ['x','#','y'].forEach(a => {
    document.querySelectorAll(`button[data-onclick="gregSetAccidental('${a}')"]`).forEach(btn => { btn.style.background = (_gregAccidental===a) ? '#5a3a20' : ''; btn.style.color = (_gregAccidental===a) ? '#fff' : ''; });
  });
  gregGst(_gregAccidental ? 'Vorzeichen ' + labels[_gregAccidental] + ' — gilt für nächste Note' : 'Vorzeichen entfernt');
}

// ── Directive text (ij., iij.) ───────────────────────────────────
function gregAddDirective(text) {
  gregPush();
  gregEntries.push({type:'directive', text});
  _gregPending = null;
  gregRefreshList();
}

// ── Comments (free text overlay) ────────────────────────────────
function gregAddComment() {
  const text = window.prompt('Kommentar-Text eingeben:', '');
  if (!text) return;
  gregPush();
  // Anchor to the last note by default (a reasonable starting spot); the
  // user can then drag it to sit near whichever note it should label —
  // dragging re-anchors it to the nearest note automatically.
  const lastNoteIdx = gregCountNoteEntries(gregEntries) - 1;
  gregEntries.push({type:'comment', text,
    anchorNoteIdx: lastNoteIdx >= 0 ? lastNoteIdx : null,
    dx: 0, dy: -30});
  _gregPending = null;
  gregRefreshList();
  gregGst('Kommentar hinzugefügt — an letzter Note verankert, zum Verschieben ziehen');
}


