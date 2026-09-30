// The separate "assisted" equipment denotes manual assistance. Machine
// assistance remains available; generated steps do not override this taxonomy.
export const needsPartner=ex=>!!ex&&(ex.eq==='assisted'||ex.requiresPartner===true||/\bpartner\b|\bspotter\b|someone hold|manual resistance|同伴辅助|搭档辅助|双人|多人/.test([ex.n,ex.nameEn,ex.nameZh,...(ex.st||[])].join(' ').toLowerCase()))
