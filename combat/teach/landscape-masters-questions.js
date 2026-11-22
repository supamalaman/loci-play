"use strict";
// Landscape Masters, Teach S1 (Mala, 2026-11-09: "write up a teach spec for the following EDAW [+ designer list]"; spec
// cursor-landscape-masters-teach-spec; rulings R-20261110-08 D1-D4 and R-20261121-28). Same question shape as
// concept-questions.js plus masterId: { id, topic, prompt, choices[3], answer, explain, masterId }. Two per master, the
// wrong choices are other masters. Every fact is checked against a published page (the shelf's qa-evidence/sources.md):
// design ideas and named works only, no birth-year trivia, no battle mechanic.
// `lines` are the curated Wisdom lines (spec D2): third-person paraphrases of a master's idea, never a quotation, so the
// card's author line names who the idea is about, and `title` says it is a paraphrase.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLandscapeMasters = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MASTERS = {
    edaw: "EDAW", halprin: "Lawrence Halprin", mayaLin: "Maya Lin", mcHarg: "Ian McHarg", jamesRose: "James Rose", noguchi: "Isamu Noguchi",
    volpe: "Joseph S. R. Volpe", leNotre: "André Le Nôtre", capabilityBrown: "Lancelot “Capability” Brown", lenne: "Peter Joseph Lenné",
    olmsted: "Frederick Law Olmsted", jekyll: "Gertrude Jekyll", jellicoe: "Geoffrey Jellicoe", church: "Thomas Church", pechere: "René Pechère",
    burleMarx: "Roberto Burle Marx", corajoud: "Michel Corajoud",
  };
  const N = MASTERS;
  // The right answer is moved to slot (question number mod 3), so no slot is the usual answer; the order of the two wrong ones is kept.
  let seq = 0;
  const Q = (masterId, n, prompt, choices, answer, explain) => {
    const right = choices[answer], wrong = choices.filter((_, i) => i !== answer), slot = seq++ % 3, out = wrong.slice();
    out.splice(slot, 0, right);
    return { id: `lm-${masterId}-${n}`, topic: "Landscape Masters", prompt, choices: out, answer: slot, explain, masterId };
  };
  const questions = [
    Q("edaw", 1, "Garrett Eckbo co-founded a firm known by its four partners' initials. Which firm?", [N.edaw, N.church, N.halprin], 0,
      "EDAW: Eckbo, Dean, Austin and Williams, the firm Garrett Eckbo co-founded."),
    Q("edaw", 2, "Whose firm grew from the partner who wrote Landscape for Living (1950) and held that landscape design could be a means of social change?", [N.jamesRose, N.edaw, N.olmsted], 1,
      "Garrett Eckbo, whose partnership became EDAW, designed farm-worker camps and public housing prototypes as well as gardens."),
    Q("halprin", 1, "Who devised the RSVP Cycles, a design process built on human scale, the user's experience and community participation?", [N.mcHarg, N.halprin, N.jellicoe], 1,
      "Lawrence Halprin: design as a process people take part in, not a picture handed down."),
    Q("halprin", 2, "Who adapted dance and music notation into 'motation', diagrams of movement through a landscape over time?", [N.church, N.noguchi, N.halprin], 2,
      "Halprin scored landscapes like choreography; Freeway Park in Seattle was built over and around a freeway."),
    Q("mayaLin", 1, "Who set two black granite walls into an earthen mound in a wide V, so the memorial reads as a cut in the ground?", [N.mayaLin, N.noguchi, N.leNotre], 0,
      "Maya Lin, the Vietnam Veterans Memorial: the cut suggests a healing wound, and the arms point to the Washington Monument and the Lincoln Memorial."),
    Q("mayaLin", 2, "Whose memorial walls are polished so they reflect the visitors among the names, which run in order of date of death?", [N.jellicoe, N.pechere, N.mayaLin], 2,
      "Maya Lin's Vietnam Veterans Memorial: the living see themselves in the stone that holds the names."),
    Q("mcHarg", 1, "Whose 1969 book Design with Nature shaped U.S. environmental policy and the planning of new communities and regions?", [N.olmsted, N.mcHarg, N.edaw], 1,
      "Ian McHarg: read the land's natural systems first, then decide where to build."),
    Q("mcHarg", 2, "Whose 'layer cake' method read a site as stacked environmental layers, an approach that later influenced GIS?", [N.mcHarg, N.lenne, N.volpe], 0,
      "McHarg's overlays: environmental layers stacked, so the land's suitability comes before form."),
    Q("jamesRose", 1, "Which modernist worked with Garrett Eckbo and Dan Kiley at Harvard on design experiments published in Pencil Points, 1938-1939?", [N.church, N.jamesRose, N.jellicoe], 1,
      "James Rose: one of the Harvard trio who carried modernism into the garden."),
    Q("jamesRose", 2, "Who built his own Ridgewood, New Jersey, house and garden (1953) from recycled materials: old doors as benches, railroad ties as terrace walls?", [N.jamesRose, N.noguchi, N.pechere], 0,
      "Rose made the garden by hand from what was at hand: space you move through, not a view from the parlour."),
    Q("noguchi", 1, "Whose 1956 garden for UNESCO's Paris headquarters helped establish his name for plazas, playgrounds and gardens?", [N.noguchi, N.burleMarx, N.corajoud], 0,
      "Isamu Noguchi: a sculptor who worked the ground itself."),
    Q("noguchi", 2, "Playscapes in Atlanta's Piedmont Park (1976) treats play equipment as sculpture. Whose only playground built in his lifetime is it?", [N.olmsted, N.halprin, N.noguchi], 2,
      "Noguchi's Playscapes grew from his unbuilt 1933 Play Mountain: play as topography and sculpture."),
    Q("volpe", 1, "Which Professor Emeritus of Landscape Architecture at UMass Amherst built a teaching method on a series of three-dimensional spatial models?", [N.mcHarg, N.volpe, N.jellicoe], 1,
      "Joseph S. R. Volpe: students learn landform, water, plants and structure by building space in models."),
    Q("volpe", 2, "Whose students design experiences of space for people by studying landform, water, vegetation and structures in a sequence of models?", [N.church, N.halprin, N.volpe], 2,
      "Joseph S. R. Volpe's model sequence teaches how a space feels to the people in it."),
    Q("leNotre", 1, "Whose gardens at Vaux-le-Vicomte (1656-1661), made for Nicolas Fouquet, launched his career?", [N.capabilityBrown, N.leNotre, N.lenne], 1,
      "André Le Nôtre: the garden ordered by one controlling idea."),
    Q("leNotre", 2, "At Versailles, who kept the natural slope and extended the east-west axis into a long perspective, balancing symmetry with groves and parterres?", [N.leNotre, N.pechere, N.capabilityBrown], 0,
      "Le Nôtre arranged the whole garden on one long perspective from the palace."),
    Q("capabilityBrown", 1, "By the traditional story, who earned his nickname by telling owners their land had great 'capabilities' for improvement?", [N.capabilityBrown, N.jekyll, N.leNotre], 0,
      "Lancelot Brown: read what a place could become (the story is traditional, as told by the National Trust)."),
    Q("capabilityBrown", 2, "Whose parkland of scattered trees, winding lakes and shaped ground looked so natural that people mistook it for wild countryside?", [N.olmsted, N.capabilityBrown, N.lenne], 1,
      "Brown's landscapes were made to look unmade: the National Trust cares for nearly 20, Stowe and Croome among them."),
    Q("lenne", 1, "Who planned the Klosterberg Volksgarten in Magdeburg (1824), called Germany's first public people's park funded by a city?", [N.olmsted, N.lenne, N.pechere], 1,
      "Peter Joseph Lenné: the landscape garden opened to the public, with meadows, tree groups and only curved paths."),
    Q("lenne", 2, "Whose 1840 plan for Berlin linked the Brandenburg Gate through the Tiergarten to Charlottenburg Palace, adding green spaces north and south?", [N.lenne, N.leNotre, N.corajoud], 0,
      "Lenné thought in networks: parks joined across a city, not one garden alone."),
    Q("olmsted", 1, "Whose Greensward plan, with Calvert Vaux, won the Central Park competition by hiding the four cross-park roads below meadows, water and woods?", [N.olmsted, N.capabilityBrown, N.halprin], 0,
      "Frederick Law Olmsted: the park as a continuous refuge; the city's traffic passes underneath."),
    Q("olmsted", 2, "Who designed Boston's Emerald Necklace, a connected chain of parks and parkways meant to improve residents' health?", [N.mcHarg, N.church, N.olmsted], 2,
      "Olmsted's parks were public health infrastructure; floodgates turned the polluted Back Bay Fens back into salt marsh."),
    Q("jekyll", 1, "Trained as an artist, who arranged garden colour, texture and seasonal change in broad drifts, as a painter composes?", [N.burleMarx, N.jekyll, N.church], 1,
      "Gertrude Jekyll: planting as painting."),
    Q("jekyll", 2, "Who softened the architect Edwin Lutyens's formal layouts with layered planting, at Hestercombe and Castle Drogo?", [N.jekyll, N.pechere, N.jamesRose], 0,
      "Jekyll and Lutyens: his formal lines, her drifts of plants."),
    Q("jellicoe", 1, "Who wrote The Landscape of Man (1975) with his wife Susan, after his three-volume Studies in Landscape Design?", [N.jellicoe, N.mcHarg, N.church], 0,
      "Geoffrey Jellicoe: landscape as a history of human ideas, and gardens that carry hidden meaning."),
    Q("jellicoe", 2, "At Sutton Place, Surrey (from 1980), who set an enlarged marble version of Ben Nicholson's White Relief in the garden?", [N.noguchi, N.jellicoe, N.mayaLin], 1,
      "Jellicoe joined art and garden there: the Nicholson wall, a Paradise Garden and a serpentine lake."),
    Q("church", 1, "Whose book Gardens Are for People became a guide to the modern residential garden?", [N.church, N.jamesRose, N.edaw], 0,
      "Thomas Church: the garden designed around how the household lives outdoors."),
    Q("church", 2, "Whose most famous design is the Donnell Garden in Sonoma, California, inspired partly by outdoor living in Italy and Spain?", [N.burleMarx, N.halprin, N.church], 2,
      "Thomas Church balanced the site, the architecture and the clients' life outdoors."),
    Q("pechere", 1, "Which landscape architect designed the Labyrinth at the Van Buuren gardens, seven green rooms themed on the Song of Songs?", [N.leNotre, N.pechere, N.corajoud], 1,
      "René Pechère: formal green rooms with a theme, seven of them in the Labyrinth (begun 1968)."),
    Q("pechere", 2, "At Brussels' Mont des Arts, who laid five box-edged lawn parterres meant to read as one continuous parterre?", [N.pechere, N.leNotre, N.jekyll], 0,
      "Pechère reworked the proportions so the esplanade read long and slender: one parterre, not five."),
    Q("burleMarx", 1, "Who, after studying tropical plants at Berlin's Dahlem Botanical Garden, treated gardens as paintings of bold plant masses?", [N.jekyll, N.noguchi, N.burleMarx], 2,
      "Roberto Burle Marx: abstract tropical planting, with free-form, colourful paving."),
    Q("burleMarx", 2, "Who designed the Copacabana Beach promenade and nearby Flamengo Park, after treating gardens as paintings of bold plant masses?", [N.burleMarx, N.corajoud, N.olmsted], 0,
      "Burle Marx's Copacabana paving: painting at the scale of a city."),
    Q("corajoud", 1, "Who designed Bordeaux's Miroir d'eau (2006), a granite basin under a thin sheet of water, as part of the quays project?", [N.corajoud, N.pechere, N.mayaLin], 0,
      "Michel Corajoud: the Miroir d'eau, about 2 cm of water on granite that mists every 15 minutes, on Bordeaux's quays."),
    Q("corajoud", 2, "The Parc du Sausset in Seine-Saint-Denis, begun in 1980 with Claire, is a principal work of which landscape architect?", [N.lenne, N.corajoud, N.halprin], 1,
      "The Parc du Sausset is among the principal parks of Michel and Claire Corajoud's practice, with Claire part of the project from its start."),
  ];
  const L = (masterId, voice, text) => ({ masterId, voice, text, author: N[masterId], title: "a paraphrase of the idea, not a quotation" });
  const lines = [
    L("edaw", "history", "Garrett Eckbo held that landscape design could be a means of social change: he designed farm-worker camps as well as gardens."),
    L("halprin", "reflection", "Halprin scored a landscape the way a choreographer scores a dance: you design what people will do there, over time."),
    L("mayaLin", "reflection", "Maya Lin cut the memorial into the ground, and the polished stone shows the living their own faces among the names."),
    L("mcHarg", "history", "McHarg read a site as a stack of environmental layers, and let what the land was suited for decide where to build."),
    L("jamesRose", "reflection", "James Rose built his garden from old doors and railroad ties: a modern garden is space you move through, not a view."),
    L("noguchi", "reflection", "Noguchi made play equipment into sculpture and sculpture into ground: in his playgrounds the land itself is the toy."),
    L("volpe", "reflection", "Joseph Volpe taught space by building it: model after model, until landform, water and plants became an experience for people."),
    L("leNotre", "history", "Le Nôtre kept the slope at Versailles and drew the east-west axis out into one long perspective, with groves and parterres in balance."),
    L("capabilityBrown", "history", "By the old story, Capability Brown told owners their land had capabilities; his parks looked so natural that people took them for wild country."),
    L("lenne", "history", "Lenné opened the landscape garden to everyone: Magdeburg's Volksgarten was a park paid for by the city, for its people."),
    L("olmsted", "history", "Olmsted sank Central Park's roads below its meadows and strung Boston's parks into a necklace: parks as the city's health."),
    L("jekyll", "reflection", "Gertrude Jekyll planted as she had painted: colour and texture in broad drifts that change with the season."),
    L("jellicoe", "reflection", "Jellicoe wrote the history of landscape as a history of human ideas, and set art inside his gardens to carry their meaning."),
    L("church", "history", "Thomas Church's book said it in its title: gardens are for people, designed for the life lived in them."),
    L("pechere", "reflection", "René Pechère made formal rooms of green with a theme: the Labyrinth's seven rooms follow the Song of Songs."),
    L("burleMarx", "reflection", "Burle Marx painted with plants: bold masses of tropical planting, and colourful free-form paving along Copacabana."),
    L("corajoud", "reflection", "At Bordeaux, Michel Corajoud laid a thin sheet of water over a granite basin on the quays: the Miroir d'eau, opened in 2006."),
  ];
  return { MASTERS, questions, lines };
});
