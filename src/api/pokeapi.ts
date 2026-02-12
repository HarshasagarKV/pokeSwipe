// src/api/pokeapi.ts

export const getRandomPokemon = async () => {
  const id = Math.floor(Math.random() * 151) + 1;
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data = await res.json();

  return {
    id,
    name: data.name.toUpperCase(),
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/${id}.svg`,
    imageFallback: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
    types: data.types.map((t: any) => t.type.name),
    abilities: data.abilities.slice(0, 2).map((a: any) => a.ability.name),
  };
};
