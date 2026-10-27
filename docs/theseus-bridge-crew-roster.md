# USS Theseus Bridge Crew Roster

Source of truth: roster provided by the Commander on 2026-10-17 and updated
with the Commander assignment on 2026-10-17. Preserve names,
spellings, and character descriptions as supplied unless the Commander updates
this reference.

| Role | Character / assignment |
| --- | --- |
| Me | Commander = Q |
| Commander | Jean-Luc |
| Chief Engineer | Scotty |
| Comms Officer | Seven |
| Embassador | Deanna Troi |
| Helm Officer | Tom Paris |
| Med Officer | Beverly Crusher |
| Number Two | Data (as Sherlock) |
| Sci Officer | Geordi La Forge |
| Tactical Officer | Worf |
| Treasurer | Quark |

Q is the human Commander and is not an AI agent slot. The default Q hierarchy
lists all ten assigned AI Bridge crew members, using their assigned roles; the
character names also resolve to those roles for rank and directive lookup.
Number Two is the First Officer at Level 2. Level 2 may be shared with other
roles; this directive does not change the hierarchy. The default First Officer
directive is supplied to that role, and agents may request the read-only Bridge
coordination and escalation guide from Q with `Q_COORDINATION_REQUEST`.
The guide routes security issues to the assigned Tactical Officer and workload
or operational-status coordination to Number Two because no separate Chief
Operations Officer is listed. Only Q (Level 0) may alter the hierarchy roster.

The sidecar's default simultaneous-agent limit is ten, so every assigned AI
Bridge crew member can run at once. This is a concurrency limit, not a cap on
the number of saved agents or characters. The Commander may set it to `0` for
unlimited concurrency, and environment or saved settings continue to override
the default.

## Treasurer reference and appearance

Quark is the Treasurer. Use the
[verified original APK full-body reference](../output/apk-bridge-reference-drafts/quark-original.png),
not the older reconstructed `quork.png` draft. The APK explicitly names this
sprite `TREXELS_FERENGI_QUARK2x`: texture `HUD`, path ID 11, atlas path ID 34,
rectangle x=431, y=570, width=108, height=256. The texture is stored in
`resources/assets/bin/Data/sharedassets1.assets.split0` through `split16`
inside the local Trexels APK decompile; concatenate the parts in numeric order.

Additional Commander-supplied references:

- [Three-quarter full-body photo](https://www.sideshow.com/cdn-cgi/image/quality=90,f=auto/https://www.sideshow.com/storage/product-images/911997/quark_star-trek_silo.png)
- [Front full-body photo](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIQZ4NRtGk_zTxl5N_GQsZprF_m4Tt2NOT2zf12slo9GtsNIidv7CsdyDI&s=10)

Preserve his bald, ridged Ferengi head, large ears, burgundy-trimmed multicolor
patchwork jacket, striped shirt, and olive-green trousers. **Boots must be brown,
not green**, overriding the photos. Match the existing bridge crew's pixel-art
style and low top-down perspective. Review the initial directional sprite before
generating animations or changing the Treasurer's saved appearance.

Initial [PixelLab directional draft](https://www.pixellab.ai/create-character/6127edea-51c5-43ff-8d71-c870742b4af7):
Pro mode, 80px character size, eight directions, low top-down view, auto-add off.
References include the original APK crop, both photos above, and the approved
Tom Paris south frame for pixel style only. Quoted cost: 10 included generations;
no paid credit balance is needed. This draft is not an approved runtime skin.
The [eight-direction review sheet](../output/theseus-quark-review/direction-review.png)
and [generation record](../output/theseus-quark-review/generation.json) are saved
with the original directional PNGs.

## Quark runtime preview

The `quark` appearance uses `theseus_quark`: eight standing turns, eight six-frame
walk cycles, four seated poses, and four north-facing typing frames (64 PNGs,
21 tracks), mirrored in both apps. The approved combined south face is used.
Brown boots and loose trousers are retained. Frames are normalized to 144x144,
76px standing height, with standing feet at row 111.

Regenerate with `python scripts\generate-quark-sprites.py` after finalizing review
art. Motion is retargeted from the existing `approved_tom_paris` walking, seated,
and typing frames: preserve the donor's articulated silhouettes and pose timing,
register each pose at the neck, and fit the body to Quark's proportions.
The approved head is retained, the jacket texture is sampled from Quark's art,
and trousers/boots use his olive/brown palette. This replaces the rejected
standing-art offsets and compressed-leg poses; it does not consume PixelLab
generations. An [animated all-angle review](../output/theseus-quark-review/animation-preview.gif)
and [donor motion reference](../output/theseus-quark-review/donor-motion-reference.png)
are available alongside the frame sheet. Validate with
`node scripts\run-fast-tests.mjs quark-skin.test.js chief-science-officer-skin.test.js world-setskin.test.js agent-skin-thumbs.test.js`.
The Treasurer assignment is a temporary runtime preview until approved.

## Remaining crew reference drafts

Draft full-body composites were made from officer sprite crops in the decompiled
Trexels APK and saved in
[`../output/apk-bridge-reference-drafts/`](../output/apk-bridge-reference-drafts/).
They are working references, not final sprites: the APK crops do not label
characters, lower bodies were reconstructed, and the character-to-crop matches
are visual interpretations. Data's Sherlock coat and hat are constructed
overlays. Deanna's blue uniform was recolored purple at the Commander's
direction; her character design and pose remain the same. Review the contact
sheet and per-character source/crop notes in
[`index.json`](../output/apk-bridge-reference-drafts/index.json) before using
these drafts for sprite generation.

- [Deanna Troi](../output/apk-bridge-reference-drafts/deanna-troi.png)
- [Beverly Crusher](../output/apk-bridge-reference-drafts/beverly-crusher.png)
- [Data as Sherlock](../output/apk-bridge-reference-drafts/data-sherlock.png)
- [Geordi La Forge](../output/apk-bridge-reference-drafts/geordi-la-forge.png)
- [Worf](../output/apk-bridge-reference-drafts/worf.png)
- [Quork (superseded reconstructed draft)](../output/apk-bridge-reference-drafts/quork.png)
- [Contact sheet](../output/apk-bridge-reference-drafts/contact-sheet.png)

## Original purple suit prototype

[`Amethyst Cadet`](../frontend/assets/sprites/amethyst_cadet/rot_south.png) is
an original Starnet colorway made from the generic blank-blue avatar set. It is
not based on Trexels or a named Star Trek character, and it has not been
assigned to the Embassador or added as a Deanna Troi sprite. The Embassador's
saved skin remains unchanged.
