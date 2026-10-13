/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "hexagonal-inward-only",
      severity: "error",
      comment: "Dependencies point inward only: domain <- application <- adapters/worker/ui",
      from: { path: "src/domain" },
      to: { path: "src/(application|adapters|worker|ui)" },
    },
    {
      name: "application-no-outward",
      severity: "error",
      from: { path: "src/application" },
      to: { path: "src/(adapters|worker|ui)" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: { doNotFollow: { path: "node_modules" } },
};
