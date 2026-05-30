from uuid import UUID
from collections import defaultdict, deque
from typing import List, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityNode, ActivityEdge
from app.models.enums import EdgeType


class DAGSimulator:
    def __init__(self, nodes: List[ActivityNode], edges: List[ActivityEdge]):
        self.nodes = {node.id: node for node in nodes}
        self.edges = edges
        
        self.adj = defaultdict(list)
        self.in_degree = defaultdict(int)
        
        # Build graph
        for edge in edges:
            self.adj[edge.from_node_id].append(edge.to_node_id)
            self.in_degree[edge.to_node_id] += 1
            
        # Ensure all nodes are in in_degree dict
        for node_id in self.nodes:
            if node_id not in self.in_degree:
                self.in_degree[node_id] = 0

    def get_topological_sort(self) -> List[UUID]:
        """Returns a list of node IDs in topological order. Raises ValueError if a cycle is detected."""
        queue = deque([node_id for node_id, deg in self.in_degree.items() if deg == 0])
        topo_order = []
        
        in_degree_copy = self.in_degree.copy()
        
        while queue:
            curr = queue.popleft()
            topo_order.append(curr)
            
            for neighbor in self.adj[curr]:
                in_degree_copy[neighbor] -= 1
                if in_degree_copy[neighbor] == 0:
                    queue.append(neighbor)
                    
        if len(topo_order) != len(self.nodes):
            raise ValueError("Cycle detected in DAG")
            
        return topo_order

    def simulate_expected_value(self) -> Dict[str, Any]:
        """
        Calculates the expected value (EV) and cumulative probability for each node in the DAG.
        Returns a dictionary with node-level metrics and project-level totals.
        """
        topo_order = self.get_topological_sort()
        
        # Track cumulative probability of reaching and successfully completing a node
        cumulative_prob = {node_id: 1.0 for node_id in self.nodes}
        # Track expected rewards
        expected_rewards = {node_id: 0.0 for node_id in self.nodes}
        # Track expected costs
        expected_costs = {node_id: 0.0 for node_id in self.nodes}
        
        for curr_id in topo_order:
            node = self.nodes[curr_id]
            
            # The cumulative probability of curr_id is the probability of reaching it
            # multiplied by its own success probability.
            # Assuming REQUIRED edges mean we MUST succeed in all parents.
            # For simplicity in this engine, cumulative_prob[curr_id] is already updated by parents.
            
            curr_cum_prob = cumulative_prob[curr_id] * node.success_probability
            cumulative_prob[curr_id] = curr_cum_prob
            
            # Expected reward for this node is the reward if we reach it and succeed
            ev_reward = curr_cum_prob * node.reward_points
            expected_rewards[curr_id] = ev_reward
            
            # Expected cost is incurred if we REACH the node and attempt it
            # (which means parents succeeded). We attempt it regardless of whether it succeeds.
            parent_success_prob = cumulative_prob[curr_id] / node.success_probability if node.success_probability > 0 else cumulative_prob[curr_id]
            ev_cost = parent_success_prob * node.cost_hours
            expected_costs[curr_id] = ev_cost
            
            # Propagate to children
            for neighbor in self.adj[curr_id]:
                # If required, the child's base probability of being attempted is multiplied by this node's success probability.
                # In a more complex model, we'd handle multiple parents (e.g. AND / OR logic).
                # Here we assume AND logic for all incoming edges.
                cumulative_prob[neighbor] *= curr_cum_prob

        total_ev_reward = sum(expected_rewards.values())
        total_ev_cost = sum(expected_costs.values())
        
        return {
            "total_expected_reward": round(total_ev_reward, 2),
            "total_expected_cost": round(total_ev_cost, 2),
            "nodes": {
                str(n_id): {
                    "cumulative_probability": round(cumulative_prob[n_id], 4),
                    "expected_reward": round(expected_rewards[n_id], 2),
                    "expected_cost": round(expected_costs[n_id], 2)
                } for n_id in topo_order
            }
        }


async def simulate_project_strategy(db: AsyncSession, project_id: UUID) -> Dict[str, Any]:
    """Service function to load a project's DAG and run the EV simulator."""
    # Load all nodes
    nodes_result = await db.execute(
        select(ActivityNode).where(ActivityNode.project_id == project_id)
    )
    nodes = nodes_result.scalars().all()
    
    if not nodes:
        return {"total_expected_reward": 0.0, "total_expected_cost": 0.0, "nodes": {}}

    # Load all edges
    # We only care about edges between the nodes in this project.
    node_ids = [n.id for n in nodes]
    edges_result = await db.execute(
        select(ActivityEdge).where(
            ActivityEdge.from_node_id.in_(node_ids),
            ActivityEdge.to_node_id.in_(node_ids),
        )
    )
    edges = edges_result.scalars().all()
    
    simulator = DAGSimulator(list(nodes), list(edges))
    return simulator.simulate_expected_value()
