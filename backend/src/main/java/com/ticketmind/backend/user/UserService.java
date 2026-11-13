package com.ticketmind.backend.user;

import com.ticketmind.backend.common.exception.ErrorCode;
import com.ticketmind.backend.common.exception.ApiException;
import com.ticketmind.backend.security.jwt.JwtPrincipal;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {

	private final UserRepository userRepository;

	public UserService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Transactional(readOnly = true)
	public List<User> listStaff() {
		return userRepository.findByRoleInOrderByDisplayNameAsc(
				List.of(UserRole.AGENT, UserRole.ADMIN));
	}

	@Transactional(readOnly = true)
	public User require(UUID id) {
		// A 404 either way, so a caller learns nothing about which ids exist;
		// the code only names what was looked up.
		return userRepository.findById(id).orElseThrow(ErrorCode.USER_NOT_FOUND::exception);
	}

	@Transactional
	public User changeRole(JwtPrincipal actor, UUID targetId, UserRole next) {
		User target = userRepository.findById(targetId).orElseThrow(ErrorCode.USER_NOT_FOUND::exception);
		if (target.getRole() == next) {
			return target;
		}
		// Losing the last ADMIN means nobody can ever grant the role again -
		// the bootstrap only fires when zero admins exist, so this would be
		// recoverable but only by a restart with config changed. Refuse.
		// Counts active admins only: a deactivated admin cannot sign in, so
		// leaving only those behind is the same lockout.
		if (target.getRole() == UserRole.ADMIN && isLastActiveAdmin(targetId)) {
			throw new ApiException(ErrorCode.LAST_ADMIN);
		}
		target.changeRole(next);
		return userRepository.save(target);
	}

	@Transactional(readOnly = true)
	public List<User> listAll() {
		return userRepository.findAll(Sort.by("displayName"));
	}

	/**
	 * Deactivation is enforced at login and at refresh, so the user is out
	 * once their current access token expires (at most its TTL, 15 minutes).
	 */
	@Transactional
	public User changeActive(JwtPrincipal actor, UUID targetId, boolean active) {
		User target = userRepository.findById(targetId).orElseThrow(ErrorCode.USER_NOT_FOUND::exception);
		if (!active) {
			if (target.getId().equals(actor.id())) {
				throw new ApiException(ErrorCode.FORBIDDEN, "cannot deactivate yourself");
			}
			if (target.getRole() == UserRole.ADMIN && isLastActiveAdmin(targetId)) {
				throw new ApiException(ErrorCode.LAST_ADMIN);
			}
		}
		target.changeActive(active);
		return userRepository.save(target);
	}

	@Transactional
	public User unlock(UUID targetId) {
		User target = userRepository.findById(targetId).orElseThrow(ErrorCode.USER_NOT_FOUND::exception);
		target.unlock();
		return userRepository.save(target);
	}

	private boolean isLastActiveAdmin(UUID adminId) {
		return !userRepository.existsByRoleAndActiveTrueAndIdNot(UserRole.ADMIN, adminId);
	}
}
