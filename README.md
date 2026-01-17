# WalkForage

A location-based foraging game where resources spawn based on real-world geology and biomes.

## Features

- **Geology-based stone spawning**: Stone types determined by local lithology
- **Biome-based wood spawning**: Tree species based on ecoregion and biome
- **35 stone types** across sedimentary, igneous, metamorphic, and ore categories
- **66 wood types** including hardwoods, softwoods, and tropical species
- **Toolstone coverage**: Every geological region has access to at least one knappable stone

## Development

```bash
npm install
npm test
npm start
```

### Validation

```bash
npx tsx src/scripts/validateResources.ts
```

## Data Sources & Attribution

This project uses geological and ecological data under CC-BY-4.0:

- **[Macrostrat](https://macrostrat.org)** - Lithology and geological unit data
- **[RESOLVE Ecoregions 2017](https://ecoregions.appspot.com)** - Biome and biogeographic realm boundaries

## License

MIT
