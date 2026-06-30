import { error } from '@sveltejs/kit';
import { loadProtocol, listProtocols } from '$lib/server/protocols';
import { listPersonas } from '$lib/server/personas';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const protocol = loadProtocol(params.protocol_id);
	if (!protocol) {
		throw error(404, `Protocol "${params.protocol_id}" not found`);
	}

	const allPersonas = listPersonas();
	const applicable_personas = allPersonas.filter((p) =>
		p.applicable_indications.includes(protocol.meta.indication)
	);

	const all_protocols = listProtocols().map((m) => ({ id: m.id, label: m.short_label ?? m.label }));

	return {
		protocol,
		applicable_personas,
		all_protocols
	};
};
