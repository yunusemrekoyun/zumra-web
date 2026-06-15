declare module '@kadoresmi00/turkey-cities-counties/utils/data.json' {
  const value: {
    data: Array<{
      il_adi: string;
      ilceler: Array<{ ilce_adi: string }>;
    }>;
  };

  export default value;
}

