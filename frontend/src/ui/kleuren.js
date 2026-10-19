// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
export const C = {
  primary:'#1C6EA4',     // clean professional blue
  primaryDark:'#155888',
  light:'#4A92C4',
  green:'#2E8B57',
  ink:'#1B2733',
  ink2:'#243443',
  ink3:'#33485A',
  bg:'#F7F9FB',          // very light page background
  surface2:'#F0F4F8',    // raised light surface
  border:'#E4E9EF',      // soft light border
  rowAlt:'#F5F8FB',
  white:'#FFFFFF',
  text:'#1B2733',
  muted:'#6A7A88',
  danger:'#C8503E',
  card:'#FFFFFF',
  shadow:'0 1px 2px rgba(27,39,51,0.04)',
  shadowLg:'0 16px 48px rgba(27,39,51,0.16)',
  timeline:'#FAFCFD',
  calBg:'#FCFDFE',
  hour:'#1B2733',
  halfHour:'#A8B4BE',
  blueAccent:'#E4F0F8',
}
export const NEW_PALETTE = [
  {bg:'#DDEAF5',brd:'#A4C4DE',fg:'#1C4E72'},{bg:'#D4E3F0',brd:'#99BBD8',fg:'#184567'},
  {bg:'#E3EDF6',brd:'#ACCBE2',fg:'#205377'},{bg:'#CFDFEE',brd:'#90B5D3',fg:'#163E5E'},
  {bg:'#DAE7F3',brd:'#A0C0DA',fg:'#1D4F73'},{bg:'#E6EFF7',brd:'#B2CFE6',fg:'#23577C'},
]
export const CTRL_PALETTE = [
  {bg:'#DBEBE0',brd:'#A6CBB2',fg:'#296547'},{bg:'#D4E7DB',brd:'#9CC4A9',fg:'#245A3F'},
  {bg:'#E1F0E6',brd:'#B0D5BC',fg:'#2E6B4E'},{bg:'#D0E5D7',brd:'#94BFA2',fg:'#1F5238'},
  {bg:'#D8ECE4',brd:'#A0CCBC',fg:'#225A4D'},{bg:'#DDEEDF',brd:'#AAD0B2',fg:'#2B6647'},
]
export const BUF_COLOR = {bg:'#F0F3F6',brd:'#D2DBE3',fg:'#6A7A88'}
// Functiekamers: onderzoekscodes krijgen elk een eigen, rustige tint (12 kleuren, daarna herhaald).
export const FK_PALETTE=[
  {bg:'#DDEAF5',brd:'#A4C4DE',fg:'#1C4E72'},{bg:'#DBEBE0',brd:'#A6CBB2',fg:'#296547'},{bg:'#EEE4F7',brd:'#C9B3E3',fg:'#5B3A86'},
  {bg:'#FBE9D7',brd:'#EBC49A',fg:'#8A4B12'},{bg:'#E2F0F1',brd:'#A9D2D5',fg:'#1F5C61'},{bg:'#F6E5EA',brd:'#E0B4C1',fg:'#8A3652'},
  {bg:'#EAF0DA',brd:'#C2D39A',fg:'#4C6212'},{bg:'#E4E8F6',brd:'#B4BEE4',fg:'#33418A'},{bg:'#F5EEDD',brd:'#E0CF9E',fg:'#7A5F12'},
  {bg:'#E0EEF9',brd:'#A7CCE8',fg:'#1D5A8A'},{bg:'#E9E4E0',brd:'#C9BDB2',fg:'#5E4A3A'},{bg:'#DFF1EA',brd:'#A4D3C1',fg:'#1E5F48'},
]
// Flexruimte / buffer — licht oranje, duidelijk te onderscheiden van de afspraken
export const FLEX_COLOR = {bg:'#FFF1DE',bg2:'#FFF9F0',brd:'#F0B96B',fg:'#8A5312'}
export const FLEX_STRIPE=(a=6,b=13)=>`repeating-linear-gradient(45deg,${FLEX_COLOR.bg},${FLEX_COLOR.bg} ${a}px,${FLEX_COLOR.bg2} ${a}px,${FLEX_COLOR.bg2} ${b}px)`
