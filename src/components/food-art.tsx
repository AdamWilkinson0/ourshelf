import type { CSSProperties, ReactNode } from "react";

const red = "#e98f84";
const rose = "#edafa7";
const orange = "#efa56b";
const yellow = "#f5d879";
const cream = "#f7ead1";
const tan = "#e4bb91";
const brown = "#c88f72";
const green = "#a6c48c";
const darkGreen = "#80a879";
const blue = "#abc8df";
const purple = "#c7a7cc";
const white = "#fff";

// Packaged foods and specific phrases take priority over their ingredients.
const groceries = [
  [
    "orange-juice",
    /\b(?:orange(?: and mango)? juice|oj)\b/,
    <>
      <path fill={orange} d="M5 8l4-5h7l3 5v13H5Z" />
      <path fill={cream} d="M5 8h14l-3-5H9ZM15 8h4v13h-4Z" />
      <circle fill={yellow} cx="10" cy="14" r="2.6" />
      <path d="M10 11.4v5.2M7.4 14h5.2" />
    </>,
  ],
  [
    "crisps",
    /\b(?:crisps?|potato chips|tortilla chips|corn chips|kettle chips|nachos|doritos|pringles|walkers)\b/,
    <>
      <path fill={yellow} d="M5 3h14l-1 4 1 10v4H5v-4L6 7Z" />
      <path d="M5.5 6h13M5.5 18h13" />
      <path fill={orange} d="M9 14c-2-2 2-5 4-4 2 1 2 3 0 4-1 1-3 1-4 0Z" />
    </>,
  ],
  [
    "peanut-butter",
    /\b(?:peanut|almond|cashew|nut) butter\b/,
    <>
      <rect fill={tan} x="5" y="6" width="14" height="15" rx="3" />
      <rect fill={cream} x="5" y="3" width="14" height="4" rx="1" />
      <path fill={brown} d="M9 16c-2-2 0-4 2-4 1-2 4-2 4 0s-2 4-4 4c-1 1-2 1-2 0Z" />
    </>,
  ],
  [
    "jam",
    /\b(?:jam|marmalade|berry preserves|strawberry preserves)\b/,
    <>
      <rect fill={rose} x="5" y="6" width="14" height="15" rx="3" />
      <rect fill={cream} x="5" y="3" width="14" height="4" rx="1" />
      <path fill={red} d="M12 12c-3-3-6 1 0 5 6-4 3-8 0-5Z" />
    </>,
  ],
  [
    "honey",
    /\bhoney\b(?! (?:roast|glazed|cured))/,
    <>
      <path fill={yellow} d="M8 6h8l3 4v8l-3 3H8l-3-3v-8Z" />
      <path fill={tan} d="M8 3h8v3H8Z" />
      <path fill={orange} d="m10 11 4 0 2 3-2 3h-4l-2-3Z" />
    </>,
  ],
  [
    "pasta",
    /\b(?:pasta|spaghetti|fusilli|penne|tagliatelle|linguine|macaroni|rigatoni|lasagn[ae]|ravioli|tortellini|noodles?|gnocchi)\b(?! sauce)/,
    <>
      <path fill={yellow} d="m3 10 7 2-1 6-6 2 1-5Zm18 0-7 2 1 6 6 2-1-5ZM9 12h6v6H9Z" />
      <path fill={cream} d="m7 4 4 1 2-2 3 2-3 2-4 1-2-2Z" />
      <path d="m5 13 2 1m12-1-2 1" />
    </>,
  ],
  [
    "sauce",
    /\b(?:sauces?|ketchup|tomato paste|tomato puree|mayonnaise|mayo|mustard|sriracha|pesto|salad dressing)\b/,
    <>
      <path fill={red} d="M8 7h8l2 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8Z" />
      <rect fill={cream} x="8" y="3" width="8" height="4" rx="1" />
      <path fill={cream} d="M6 12h12v5H6Z" />
    </>,
  ],
  [
    "tinned",
    /\b(?:(?:canned|tinned|tin of) (?:tuna|fish|tomatoes?|sardines?)|baked beans)\b/,
    <>
      <path fill={blue} d="M5 6h14v12c0 4-14 4-14 0Z" />
      <ellipse fill={white} cx="12" cy="6" rx="7" ry="3" />
      <path fill={cream} d="M5 11c4 2 10 2 14 0v5c-4 2-10 2-14 0Z" />
    </>,
  ],
  [
    "juice",
    /\b(?:juices?|smoothies?)\b/,
    <>
      <path fill={rose} d="M5 8l4-5h7l3 5v13H5Z" />
      <path fill={cream} d="M5 8h14l-3-5H9ZM15 8h4v13h-4Z" />
      <path fill={red} d="M10 11c-2 3-3 4-1 6 2 1 4-1 1-6Z" />
    </>,
  ],
  [
    "oil",
    /\b(?:oil|olive oil|cooking spray)\b/,
    <>
      <path fill={yellow} d="M9 6h6v3l3 4v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6l3-4Z" />
      <path fill={darkGreen} d="M9 3h6v4H9Z" />
      <path fill={cream} d="M6 14h12v4H6Z" />
    </>,
  ],
  [
    "ice-cream",
    /\b(?:ice ?cream|gelato|sorbet)\b/,
    <>
      <path fill={tan} d="m7 12 5 9 5-9Z" />
      <path fill={rose} d="M7 12a3 3 0 0 1-1-5c0-5 10-5 11 0a3 3 0 0 1 0 5Z" />
      <path d="m10 15 4 3m-1-3-2 3" />
    </>,
  ],
  [
    "biscuits",
    /\b(?:biscuits?|cookies?|shortbread|crackers?|digestives?|hobnobs)\b/,
    <>
      <path fill={tan} d="M18 6c-2 0-3-2-3-3C8 2 3 6 3 12c0 5 4 9 9 9 6 0 10-5 9-11-2 0-3-2-3-4Z" />
      <path d="M8 8h.1m-2 5h.1m5-2h.1m3 5h.1m-4 1h.1m7-4h.1" />
    </>,
  ],
  [
    "chocolate",
    /\b(?:chocolate(?! (?:oat |soy |soya |almond )?milk)|dairy milk|kit kat|kinder|cocoa)\b/,
    <>
      <path
        fill={brown}
        d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      />
      <path fill={purple} d="M5 14l14-3v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
      <path d="M12 3v9M5 8h14" />
    </>,
  ],
  [
    "cereal",
    /\b(?:cereals?|corn ?flakes|granola|muesli|weetabix|porridge|oats|oatmeal)\b(?! (?:milk|drink))/,
    <>
      <path fill={blue} d="M3 11h18c-1 6-4 9-9 9s-8-3-9-9Z" />
      <path fill={tan} d="m5 11 1-4 4 3 2-5 3 5 4-3 1 4Z" />
    </>,
  ],
  [
    "bacon",
    /\b(?:bacon|gammon|pancetta|prosciutto|ham)\b/,
    <>
      <path fill={rose} d="M3 16c4-8 9 3 15-9l3 3c-5 11-11 4-15 10Z" />
      <path fill={cream} d="M3 16c4-8 9 3 15-9l-1-3C11 15 7 4 2 13Z" />
      <path d="M6 17c4-5 8 0 12-5" />
    </>,
  ],
  [
    "sausage",
    /\b(?:sausages?|chorizo|salami|frankfurters?|bratwurst|pepperoni|hot dogs?)\b/,
    <>
      <path
        fill={rose}
        d="M5 17c-2-2-2-4 0-5 4-2 7-5 9-8 1-2 5-1 6 1 3 5-9 14-12 14-2 0-2-1-3-2Z"
      />
      <path fill={brown} d="m5 17-3 2 3 2 2-2M19 4l2-2 1 3-2 1" />
      <path d="m9 13 1 2m3-5 1 2" />
    </>,
  ],
  [
    "chicken",
    /\b(?:chicken|turkey|duck|poultry|drumsticks?|wings)\b/,
    <>
      <path fill={cream} d="m9 14-3 3a2.1 2.1 0 1 0-3 2 2.1 2.1 0 1 0 3 1l4-4Z" />
      <path
        fill={tan}
        d="M8 13c-1-2 1-3 2-4 0-3 2-5 5-5 5 0 7 5 4 8-2 2-4 2-6 3l-1 2c-2 1-5-2-4-4Z"
      />
      <path d="M14 7c1-1 3 0 3 1" />
    </>,
  ],
  [
    "steak",
    /\b(?:beef|steaks?|lamb|pork|venison|mince|meatballs?|patties|meat)\b/,
    <>
      <path fill={cream} d="M4 8c1-4 6-5 10-3 3 1 6 0 7 4 2 5-4 5-7 7-2 2-4 4-7 3-5-1-5-7-3-11Z" />
      <path fill={red} d="M6 9c1-3 4-3 7-2 3 1 5 0 6 3 0 2-4 2-6 4-3 2-4 4-6 3-3-1-3-5-1-8Z" />
      <path d="m9 10 3 2-2 2" />
    </>,
  ],
  [
    "prawns",
    /\b(?:prawns?|shrimps?|scampi)\b/,
    <>
      <path
        fill={rose}
        d="M5 11c0-5 4-7 9-6 4 1 5 4 4 7-1 4-4 5-7 4l1-3c3 0 4-4 1-5-2-1-4 0-4 3Z"
      />
      <path fill={red} d="m11 16-4 1-1 3 4-1 2 2 2-4Z" />
      <path d="m8 6 2 3m4-4-1 3m4-1-2 3" />
    </>,
  ],
  [
    "salmon",
    /\b(?:salmon|trout)\b/,
    <>
      <path fill={orange} d="M3 16 13 5c4-2 8 0 8 4l-7 10H5Z" />
      <path fill={cream} d="M3 16c4 2 8 2 11 3l-2 2H6Z" />
      <path d="m8 12 3 4m0-7 3 4m0-6 3 3" />
    </>,
  ],
  [
    "fish",
    /\b(?:fish|cod|haddock|tuna|sardines?|mackerel|seabass|sea bass|pollock|anchovies)\b/,
    <>
      <path fill={blue} d="M3 12c4-7 10-6 15-2l3-3v10l-3-3c-5 4-11 5-15-2Z" />
      <path d="M9 8c2 2 2 6 0 8m-3-4h.1" />
    </>,
  ],
  [
    "eggs",
    /\beggs?\b(?! (?:noodles?|pasta))/,
    <>
      <path fill={tan} d="M11 4c3 0 7 7 7 11a6 6 0 0 1-12 0c0-5 3-11 5-11Z" />
      <path d="M9 14c0-2 1-4 2-5" />
    </>,
  ],
  [
    "yoghurt",
    /\b(?:yogh?urts?|skyr|fromage frais|sour cream|creme fraiche)\b/,
    <>
      <path fill={cream} d="M5 8h14l-2 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z" />
      <path fill={blue} d="M4 5c3-2 12-2 16 0v3H4Z" />
      <path fill={rose} d="M10 12h4l1 4H9Z" />
    </>,
  ],
  [
    "milk",
    /\b(?:milks?|oat drink|soya drink|soy drink|almond drink|coconut drink|single cream|double cream)\b/,
    <>
      <path fill={cream} d="m6 8 3-5h6l3 5v13H6Z" />
      <path fill={blue} d="M6 8h12v4H6ZM14 8l1-5 3 5v13h-4Z" />
      <path d="M9 17h2" />
    </>,
  ],
  [
    "cheese",
    /\b(?:cheeses?|cheddar|mozzarella|parmesan|halloumi|feta|gouda|brie|paneer|ricotta|mascarpone)\b/,
    <>
      <path fill={cream} d="m3 12 9-8 9 5v4L3 16Z" />
      <path fill={yellow} d="m3 13 18-4v9L3 21Z" />
      <path d="M7 16h.1m5 1h.1m4-4h.1" />
    </>,
  ],
  [
    "butter",
    /\b(?:butter|margarine)\b(?! beans)/,
    <>
      <path fill={cream} d="m3 9 5-5 13 3-5 5Z" />
      <path fill={yellow} d="M3 9v8l13 3 5-5V7l-5 5Z" />
      <path d="M16 12v8M6 11v4" />
    </>,
  ],
  [
    "onion",
    /\b(?:onions?|shallots?)\b(?! (?:rings|powder|salt))/,
    <>
      <path
        fill={`var(--food-skin, ${tan})`}
        d="M12 3c-2 4-8 6-8 11a8 8 0 0 0 16 0c0-5-6-7-8-11Z"
      />
      <path d="M12 5c-4 5-6 10-3 13m3-13c4 5 6 10 3 13m-4 3 1-1 2 1" />
    </>,
  ],
  [
    "garlic",
    /\bgarlic\b(?! (?:bread|powder|salt|paste))/,
    <>
      <path
        fill={cream}
        d="m11 3 3 1c-1 3 0 4 3 6 4 3 3 8 0 9-2 1-3 1-5 0-3 2-8 0-8-4 0-3 3-6 5-7 1-1 2-3 2-5Z"
      />
      <path d="M11 8c-2 5-3 8-1 11m3-11c3 4 4 8 2 11" />
    </>,
  ],
  [
    "tomato",
    /\btomato(?:es|s)?\b/,
    <>
      <path fill={red} d="M12 7c-5-3-9 0-9 5 0 5 4 8 9 8s9-3 9-8c0-5-4-8-9-5Z" />
      <path fill={green} d="m12 7-2-4 2 1 1 3 5-1-3 3-3-1-3 2-1-4Z" />
      <path d="M6 13c0 2 1 3 2 4" />
    </>,
  ],
  [
    "lettuce",
    /\b(?:lettuces?|iceberg|romaine|little gem|butterhead|cabbages?)\b/,
    <>
      <path
        fill={green}
        d="M12 4c2-2 5-1 6 2 3 0 4 3 3 5 2 2 1 5-1 6-1 3-6 4-8 3-4 1-8-1-8-3-3-1-3-5-1-6-1-3 1-5 4-5 1-3 4-3 5-2Z"
      />
      <path fill={darkGreen} d="M12 19c-4-1-6-4-6-8 3 0 5 1 6 3 1-3 4-4 6-4 0 5-2 8-6 9Z" />
      <path d="M12 19v-5" />
    </>,
  ],
  [
    "greens",
    /\b(?:spinach|kale|rocket|arugula|watercress|salad leaves|pak choi|bok choy|chard|herbs?|basil|parsley|coriander|cilantro)\b/,
    <>
      <path fill={darkGreen} d="M4 18C1 6 14 3 21 3c0 8-4 18-13 17Z" />
      <path d="M3 21l12-12m-8 8 8-1m-5-2 1-5" />
    </>,
  ],
  [
    "carrot",
    /\bcarrots?\b/,
    <>
      <path fill={green} d="M15 9c-3-1-3-5 0-6 1 1 2 3 1 5 2-3 4-3 5-2-1 3-3 4-6 3Z" />
      <path fill={orange} d="M16 9c2 2 1 4-1 6l-9 6c-2 1-4-1-3-3l6-9c2-2 5-2 7 0Z" />
      <path d="m7 13 2 2m3-3 3 2" />
    </>,
  ],
  [
    "potato",
    /\b(?:potato(?:es)?|yams?|spuds?)\b/,
    <>
      <path fill={tan} d="M5 7c4-3 9-4 13-1 4 2 4 7-1 11-3 3-9 4-12 1-4-2-4-8 0-11Z" />
      <path d="M8 9h.1m5 5h.1m4-5h.1m-9 7h.1" />
    </>,
  ],
  [
    "pepper",
    /\b(?:peppers?|capsicums?|chill?i(?:es)?|jalapenos?)\b(?! (?:powder|flakes|sauce))/,
    <>
      <path fill={green} d="M10 8c0-3 1-5 4-5v2c-1 1-2 2-1 3Z" />
      <path
        fill={`var(--food-skin, ${red})`}
        d="M11 8c-5-3-9 1-7 6 1 2 1 5 4 6 2 1 3-1 4-1s3 2 5 0c2-1 2-4 3-6 1-4-4-7-8-5Z"
      />
      <path d="M10 10c-3 2-2 6-1 8m5-8c3 2 2 6 1 8" />
    </>,
  ],
  [
    "cucumber",
    /\b(?:cucumbers?|courgettes?|zucchinis?)\b/,
    <>
      <path fill={darkGreen} d="M7 13 15 4c3-3 8 1 6 5l-8 10Z" />
      <ellipse fill={green} cx="8" cy="16" rx="5" ry="4" transform="rotate(-37 8 16)" />
      <path d="m6 16 1 1m2-3 1 1m5-7 2 2" />
    </>,
  ],
  [
    "broccoli",
    /\b(?:broccoli|tenderstem)\b/,
    <>
      <path fill={green} d="m8 12 2 5-1 4h6l-1-4 2-5Z" />
      <path
        fill={darkGreen}
        d="M6 14a4 4 0 0 1-2-7l3-1c1-4 7-5 9-1 4-1 7 2 6 5-1 4-5 5-8 3-2 3-5 3-8 1Z"
      />
    </>,
  ],
  [
    "mushroom",
    /\b(?:mushrooms?|shiitake|portobello|chestnut mushroom)\b/,
    <>
      <path fill={cream} d="M9 12h6l1 7c0 3-8 3-8 0Z" />
      <path fill={brown} d="M3 11C4 4 9 3 12 3s8 2 9 8c0 2-4 3-9 3s-9-1-9-3Z" />
      <path d="M7 9c1-2 2-3 4-3" />
    </>,
  ],
  [
    "avocado",
    /\bavocados?\b/,
    <>
      <path fill={darkGreen} d="M12 3c4 0 5 5 8 9 3 5-1 9-8 9s-11-4-8-9c3-4 4-9 8-9Z" />
      <path fill={green} d="M12 6c2 0 3 4 6 8 2 3-1 5-6 5s-8-2-6-5c3-4 4-8 6-8Z" />
      <circle fill={brown} cx="12" cy="14" r="3" />
    </>,
  ],
  [
    "corn",
    /\b(?:sweet ?corn|corn on the cob|corn|maize)\b(?! flour)/,
    <>
      <path fill={yellow} d="M7 13V8a5 5 0 0 1 10 0v5l-5 7Z" />
      <path d="M10 6v6m4-6v6M7 9h10" />
      <path fill={green} d="M12 21c-5-1-8-5-8-10 4 1 7 4 8 7 1-4 4-6 8-7-1 6-3 9-8 10Z" />
    </>,
  ],
  [
    "beans",
    /\b(?:peas|lentils?|chickpeas?|beans?|edamame|pulses)\b/,
    <>
      <path fill={green} d="M3 14c3 4 12 1 17-8 4 7-4 15-12 14-4 0-6-3-5-6Z" />
      <circle fill={cream} cx="9" cy="16" r="2" />
      <circle fill={cream} cx="14" cy="14" r="2" />
      <path d="m18 10 2-4" />
    </>,
  ],
  [
    "apple",
    /\bapples?\b/,
    <>
      <path d="M12 8c0-3 1-5 3-6" />
      <path fill={green} d="M12 6c-2-3-4-3-6-2 1 2 3 3 6 2Z" />
      <path
        fill={`var(--food-skin, ${red})`}
        d="M12 8c-6-3-10 1-8 7 1 5 4 7 8 5 4 2 7 0 8-5 2-6-2-10-8-7Z"
      />
      <path d="M7 12c-1 1-1 2 0 3" />
    </>,
  ],
  [
    "pear",
    /\bpears?\b/,
    <>
      <path d="M12 6c0-2 1-4 3-4" />
      <path fill={green} d="M12 6c3 0 4 5 6 7 4 5-1 8-6 8s-10-3-6-8c2-2 3-7 6-7Z" />
      <path d="M8 15v2" />
    </>,
  ],
  [
    "banana",
    /\bbananas?\b/,
    <>
      <path fill={yellow} d="M3 8c5 7 14 8 15-3l3 1c1 10-6 15-12 14-4-1-6-5-6-8Z" />
      <path fill={brown} d="m18 5 1-3 3 1-1 3Z" />
      <path d="M7 16c4 3 9 1 11-3" />
    </>,
  ],
  [
    "orange",
    /\b(?:oranges?|clementines?|satsumas?|mandarins?|tangerines?)\b/,
    <>
      <circle fill={orange} cx="12" cy="13" r="8" />
      <path fill={green} d="M12 6c0-3 3-4 6-4-1 3-2 5-6 4Z" />
      <path d="M7 12h.1m1 4h.1m7 1h.1" />
    </>,
  ],
  [
    "lemon",
    /\blemons?\b/,
    <>
      <path
        fill={yellow}
        d="M5 8c2-3 6-4 10-3l3-1 1 3c4 6-1 13-8 13-2 0-3 0-5-1l-3 1-1-3 1-2c-1-3 0-5 2-7Z"
      />
      <path d="M7 10c1-1 3-2 4-2" />
    </>,
  ],
  [
    "lime",
    /\blimes?\b/,
    <>
      <ellipse fill={green} cx="12" cy="12" rx="9" ry="7" transform="rotate(-30 12 12)" />
      <path d="M7 12c1-2 2-3 4-3m5 6h.1" />
    </>,
  ],
  [
    "strawberry",
    /\bstrawberr(?:y|ies)\b/,
    <>
      <path fill={red} d="M12 7C6 4 3 8 5 13c2 4 5 8 7 8s5-4 7-8c2-5-1-9-7-6Z" />
      <path fill={green} d="m12 8-4 2 1-3-3-3 5 1 1-3 2 3 4-1-2 4 1 2Z" />
      <path d="M8 13h.1m4 3h.1m4-3h.1" />
    </>,
  ],
  [
    "berries",
    /\b(?:blueberr(?:y|ies)|blackberr(?:y|ies)|raspberr(?:y|ies)|berr(?:y|ies)|grapes?)\b/,
    <>
      <path fill={green} d="M12 8c0-4 4-5 7-5-1 4-3 6-7 5Z" />
      <circle fill={purple} cx="8" cy="12" r="4" />
      <circle fill={blue} cx="16" cy="13" r="4" />
      <circle fill={purple} cx="12" cy="17" r="4" />
      <path d="M11 16h.1m-4-5h.1m8 1h.1" />
    </>,
  ],
  [
    "bread",
    /\b(?:breads?|loaves|loaf|baguettes?|sourdough|ciabatta|bagels?|tortillas?|wraps?|buns|rolls|pitta|pita)\b/,
    <>
      <path
        fill={tan}
        d="M4 9c-2-2 0-6 4-6h8c4 0 6 4 4 6l-2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7Z"
      />
      <path fill={cream} d="M7 9c-2-1-1-3 1-3h8c2 0 3 2 1 3l-2 1v7H9v-7Z" />
    </>,
  ],
  [
    "rice",
    /\b(?:rice|basmati|quinoa|couscous)\b/,
    <>
      <path fill={cream} d="M4 11c0-2 2-3 4-3-1-2 3-3 4-1 1-2 5-1 4 1 2 0 4 1 4 3Z" />
      <path fill={blue} d="M3 11h18c-1 6-4 9-9 9s-8-3-9-9Z" />
      <path d="M9 9h.1m6 0h.1" />
    </>,
  ],
  [
    "flour",
    /\b(?:flour|caster sugar|brown sugar|granulated sugar|icing sugar)\b/,
    <>
      <path fill={cream} d="M7 3h10l-1 4 3 11a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3L8 7Z" />
      <path d="M8 7h8m-10 9h12" />
      <path fill={yellow} d="m10 12 2-2 2 2-2 2Z" />
    </>,
  ],
  [
    "tea",
    /\b(?:tea|coffee|espresso|matcha)\b/,
    <>
      <path fill={cream} d="M17 10h2a3 3 0 0 1 0 6h-3Z" />
      <path fill={blue} d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" />
      <ellipse fill={brown} cx="10.5" cy="9" rx="6.5" ry="2" />
      <path d="M9 3v2m4-3v2" />
    </>,
  ],
] as const satisfies readonly (readonly [string, RegExp, ReactNode])[];

const fallback = [
  "groceries",
  null,
  <>
    <path fill={cream} d="M4 8h16l1 11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>,
] as const;

const skinColours = [
  { key: "onion", words: /\b(?:red|purple|shallots?)\b/, fill: purple },
  { key: "onion", words: /\bwhite\b/, fill: cream },
  { key: "pepper", words: /\bgreen\b/, fill: green },
  { key: "pepper", words: /\byellow\b/, fill: yellow },
  { key: "pepper", words: /\borange\b/, fill: orange },
  { key: "apple", words: /\b(?:green|granny smith)\b/, fill: green },
];

export function FoodArt({ name }: { name: string }) {
  const normalized = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const [key, , art] = groceries.find(([, match]) => match.test(normalized)) ?? fallback;
  const skin = skinColours.find((variant) => variant.key === key && variant.words.test(normalized));
  const style = skin ? ({ "--food-skin": skin.fill } as CSSProperties) : undefined;

  return (
    <span aria-hidden="true" className="food-art" data-food-icon={key} style={style}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {art}
      </svg>
    </span>
  );
}
